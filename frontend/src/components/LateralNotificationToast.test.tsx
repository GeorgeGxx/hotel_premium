import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { LateralNotificationToast } from './LateralNotificationToast';
import { AppNotification } from '../types/hotel';

describe('LateralNotificationToast Component', () => {
  const mockNotification: AppNotification = {
    id: 'test-toast-1',
    title: 'VIP Departure',
    message: 'Suite 101 settled to zero-balance.',
    category: 'CHECK_OUT',
    timestamp: new Date().toISOString(),
    read: false,
  };

  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders title, message, category, and close button', () => {
    render(
      <LateralNotificationToast
        notification={mockNotification}
        onDismiss={vi.fn()}
      />
    );

    expect(screen.getByText('VIP Departure')).toBeInTheDocument();
    expect(screen.getByText(/Suite 101 settled to zero-balance/i)).toBeInTheDocument();
    expect(screen.getByText('CHECK_OUT')).toBeInTheDocument();
    expect(screen.getByTitle('Dismiss notification')).toBeInTheDocument();
  });

  it('triggers onDismiss when close button is clicked', () => {
    const handleDismiss = vi.fn();
    render(
      <LateralNotificationToast
        notification={mockNotification}
        onDismiss={handleDismiss}
      />
    );

    fireEvent.click(screen.getByTitle('Dismiss notification'));
    expect(handleDismiss).toHaveBeenCalledTimes(1);
  });

  it('auto-dismisses after countdown duration completes', () => {
    const handleDismiss = vi.fn();
    render(
      <LateralNotificationToast
        notification={mockNotification}
        onDismiss={handleDismiss}
        durationMs={3000}
      />
    );

    vi.advanceTimersByTime(3300);
    expect(handleDismiss).toHaveBeenCalledTimes(1);
  });

  it('pauses countdown when hovered', () => {
    const handleDismiss = vi.fn();
    const { container } = render(
      <LateralNotificationToast
        notification={mockNotification}
        onDismiss={handleDismiss}
        durationMs={3000}
      />
    );

    const toastRoot = container.firstChild as HTMLElement;
    fireEvent.mouseEnter(toastRoot);

    expect(screen.getByText('Paused')).toBeInTheDocument();

    // Advance time while paused
    vi.advanceTimersByTime(4000);
    expect(handleDismiss).not.toHaveBeenCalled();

    // Leave mouse to resume
    fireEvent.mouseLeave(toastRoot);
    expect(screen.getByText('Just now')).toBeInTheDocument();

    vi.advanceTimersByTime(3300);
    expect(handleDismiss).toHaveBeenCalledTimes(1);
  });
});
