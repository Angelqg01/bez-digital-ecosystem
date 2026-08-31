import React from 'react';
import { render, screen } from '@testing-library/react';
import SectorCard from '../../components/SectorCard';

describe('SectorCard Component', () => {
    const mockProps = {
        sector: '1. Sector Test',
        icon: <span data-testid="mock-icon">Icon</span>,
        apps: [
            {
                name: 'Test Dev App 1',
                function: 'Function of test dev app 1',
                tags: ['Tag1', 'Tag2']
            },
            {
                name: 'Test Dev App 2',
                function: 'Function of test dev app 2',
                tags: ['Tag3']
            }
        ]
    };

    it('renders sector title and icon', () => {
        render(<SectorCard {...mockProps} />);

        expect(screen.getByText('1. Sector Test')).toBeInTheDocument();
        expect(screen.getByTestId('mock-icon')).toBeInTheDocument();
    });

    it('renders all provided applications correctly', () => {
        render(<SectorCard {...mockProps} />);

        // Check App names
        expect(screen.getByText('Test Dev App 1')).toBeInTheDocument();
        expect(screen.getByText('Test Dev App 2')).toBeInTheDocument();

        // Check App functions (the text node is generally split with 'Función: ')
        expect(screen.getByText(/Function of test dev app 1/i)).toBeInTheDocument();

        // Check tags
        expect(screen.getByText('Tag1')).toBeInTheDocument();
        expect(screen.getByText('Tag2')).toBeInTheDocument();
        expect(screen.getByText('Tag3')).toBeInTheDocument();
    });
});
