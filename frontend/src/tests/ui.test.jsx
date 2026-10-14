import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, test } from 'vitest';
import { Badge, Table, peso } from '../components/ui';
import { AuthProvider } from '../hooks/useAuth';
import { Login } from '../pages/Auth';

describe('UI helpers', () => {
  test('peso formats currency', () => {
    expect(peso(1500)).toBe('₱1,500.00');
    expect(peso(null)).toBe('₱0.00');
  });

  test('Badge shows its value', () => {
    render(<Badge value="Payment Pending" />);
    expect(screen.getByText('Payment Pending')).toBeInTheDocument();
  });

  test('Table shows empty message and rows', () => {
    const { rerender } = render(<Table rows={[]} columns={[]} empty="Nothing here" />);
    expect(screen.getByText('Nothing here')).toBeInTheDocument();
    rerender(<Table rows={[{ id: 1, n: 'CS201' }]} columns={[{ header: 'Code', render: (r) => r.n }]} />);
    expect(screen.getByText('CS201')).toBeInTheDocument();
  });
});

describe('Login page', () => {
  test('renders the sign-in form', () => {
    localStorage.clear();
    render(
      <MemoryRouter>
        <AuthProvider><Login /></AuthProvider>
      </MemoryRouter>
    );
    expect(screen.getByRole('button', { name: /sign in/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/password/i)).toBeInTheDocument();
  });
});
