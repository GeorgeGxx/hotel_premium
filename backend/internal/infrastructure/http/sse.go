package http

import (
	"encoding/json"
	"fmt"
	"io"
	"log/slog"
	"sync"
	"time"

	"github.com/gin-gonic/gin"
)

type SSEMessage struct {
	Event string      `json:"event"`
	Data  interface{} `json:"data"`
}

type SSEHub struct {
	clients    map[chan SSEMessage]bool
	register   chan chan SSEMessage
	unregister chan chan SSEMessage
	broadcast  chan SSEMessage
	mu         sync.RWMutex
}

var GlobalSSEHub = NewSSEHub()

func NewSSEHub() *SSEHub {
	hub := &SSEHub{
		clients:    make(map[chan SSEMessage]bool),
		register:   make(chan chan SSEMessage),
		unregister: make(chan chan SSEMessage),
		broadcast:  make(chan SSEMessage, 256),
	}
	go hub.run()
	return hub
}

func (h *SSEHub) run() {
	for {
		select {
		case client := <-h.register:
			h.mu.Lock()
			h.clients[client] = true
			h.mu.Unlock()
			slog.Debug("SSE client connected", "total_clients", len(h.clients))

		case client := <-h.unregister:
			h.mu.Lock()
			if _, ok := h.clients[client]; ok {
				delete(h.clients, client)
				close(client)
			}
			h.mu.Unlock()
			slog.Debug("SSE client disconnected", "total_clients", len(h.clients))

		case msg := <-h.broadcast:
			h.mu.RLock()
			for client := range h.clients {
				select {
				case client <- msg:
				default:
					// Slow client, skip to prevent stalling the hub
				}
			}
			h.mu.RUnlock()
		}
	}
}

// Broadcast sends an event payload to all active SSE subscribers
func (h *SSEHub) Broadcast(event string, data interface{}) {
	h.broadcast <- SSEMessage{Event: event, Data: data}
}

// Handler returns a Gin v1.12.0 handler for streaming Server-Sent Events to React 19
func (h *SSEHub) Handler() gin.HandlerFunc {
	return func(c *gin.Context) {
		c.Writer.Header().Set("Content-Type", "text/event-stream")
		c.Writer.Header().Set("Cache-Control", "no-cache")
		c.Writer.Header().Set("Connection", "keep-alive")
		c.Writer.Header().Set("Transfer-Encoding", "chunked")
		c.Writer.Header().Set("Access-Control-Allow-Origin", "*")

		msgChan := make(chan SSEMessage, 32)
		h.register <- msgChan

		defer func() {
			h.unregister <- msgChan
		}()

		// Notify client of connection ready
		initialMsg, _ := json.Marshal(map[string]string{"status": "connected", "stream": "hotel_events"})
		c.Writer.WriteString(fmt.Sprintf("event: connected\ndata: %s\n\n", initialMsg))
		c.Writer.Flush()

		ticker := time.NewTicker(15 * time.Second)
		defer ticker.Stop()

		c.Stream(func(w io.Writer) bool {
			select {
			case <-c.Request.Context().Done():
				return false

			case <-ticker.C:
				// Heartbeat comment
				c.Writer.WriteString(": keepalive\n\n")
				c.Writer.Flush()
				return true

			case msg, ok := <-msgChan:
				if !ok {
					return false
				}
				bytes, err := json.Marshal(msg.Data)
				if err != nil {
					return true
				}
				c.Writer.WriteString(fmt.Sprintf("event: %s\ndata: %s\n\n", msg.Event, bytes))
				c.Writer.Flush()
				return true
			}
		})
	}
}
