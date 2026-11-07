import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { NotificationCenter } from './NotificationCenter';
import { AppNotification } from '../types/hotel';

describe('NotificationCenter Component', () => {
  const mockNotifications: AppNotification[] = [
    {
      id: 'notif-1',
      title: 'VIP Check-In',
      message: 'Suite 202: Lady Vivienne Westwood checked in.',
      category: 'CHECK_IN',
      timestamp: new Date().toISOString(),
      read: false,
    },
    {
      id: 'notif-2',
      title: 'Folio Settled',
      message: 'Marcus Vance settled $110.00 via Card on File.',
      category: 'FOLIO',
      timestamp: new Date().toISOString(),
      read: true,
    },
  ];

  it('renders trigger button with unread count badge', () => {
    render(
      <NotificationCenter
        notifications={mockNotifications}
        onMarkAllAsRead={vi.fn()}
        onClearAll={vi.fn()}
        onDismissNotification={vi.fn()}
      />
    );

    expect(screen.getByRole('button', { name: /Open Notifications Center/i })).toBeInTheDocument();
    // 1 unread
    expect(screen.getByText('1')).toBeInTheDocument();
  });

  it('opens feed dropdown and displays notifications list', () => {
    render(
      <NotificationCenter
        notifications={mockNotifications}
        onMarkAllAsRead={vi.fn()}
        onClearAll={vi.fn()}
        onDismissNotification={vi.fn()}
      />
    );

    const trigger = screen.getByRole('button', { name: /Open Notifications Center/i });
    fireEvent.click(trigger);

    expect(screen.getByText('Live Operations Feed')).toBeInTheDocument();
    expect(screen.getByText('VIP Check-In')).toBeInTheDocument();
    expect(screen.getByText(/Lady Vivienne Westwood/i)).toBeInTheDocument();
    expect(screen.getByText('Folio Settled')).toBeInTheDocument();
  });

  it('triggers mark all as read when button clicked', () => {
    const handleMarkRead = vi.fn();
    render(
      <NotificationCenter
        notifications={mockNotifications}
        onMarkAllAsRead={handleMarkRead}
        onClearAll={vi.fn()}
        onDismissNotification={vi.fn()}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /Open Notifications Center/i }));
    const markReadBtn = screen.getByTitle('Mark all as read');
    fireEvent.click(markReadBtn);

    expect(handleMarkRead).toHaveBeenCalledTimes(1);
  });
});
