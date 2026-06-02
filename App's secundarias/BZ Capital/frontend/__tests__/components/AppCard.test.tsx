import React from 'react';
import { render, screen } from '@testing-library/react';
import AppCard from '../../components/AppCard';

describe('AppCard Component', () => {
  const mockProps = {
    id: '12345',
    name: 'Test App',
    description: 'This is a test description for the AppCard.',
    url: 'https://stitch.withgoogle.com/projects/12345'
  };

  it('renders the app name and description correctly', () => {
    render(<AppCard {...mockProps} />);
    
    expect(screen.getByText('Test App')).toBeInTheDocument();
    expect(screen.getByText('This is a test description for the AppCard.')).toBeInTheDocument();
  });

  it('renders a valid link to the correct URL', () => {
    render(<AppCard {...mockProps} />);
    
    const downloadLink = screen.getByRole('link', { name: /Descargar \/ Acceder/i });
    expect(downloadLink).toBeInTheDocument();
    expect(downloadLink).toHaveAttribute('href', mockProps.url);
    expect(downloadLink).toHaveAttribute('target', '_blank');
    expect(downloadLink).toHaveAttribute('rel', 'noopener noreferrer');
  });
});
