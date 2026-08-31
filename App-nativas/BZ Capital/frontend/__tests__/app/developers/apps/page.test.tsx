import React from 'react';
import { render, screen } from '@testing-library/react';
import DevelopersAppsPage from '../../app/developers/apps/page';

describe('DevelopersAppsPage (Landing Page)', () => {
    it('renders the Hero Section correctly', () => {
        render(<DevelopersAppsPage />);

        const pageTitle = screen.getByRole('heading', { name: /BeZhas Ecosystem Apps & SDK/i });
        expect(pageTitle).toBeInTheDocument();
    });

    it('renders the Live Apps section with correct links', () => {
        render(<DevelopersAppsPage />);

        // Test if the "Live Apps" section header exists
        expect(screen.getByRole('heading', { level: 2, name: /Live Apps \(Integradas vía Stitch \/ API\)/i })).toBeInTheDocument();

        // Assert there are app links existing on the screen
        const downloadBtns = screen.getAllByRole('link', { name: /Descargar \/ Acceder/i });
        expect(downloadBtns.length).toBeGreaterThan(0); // There should be at least 1 (currently there are 6 live apps)

        // Check that at least one of the known App names exist
        expect(screen.getByText('BeZhas Stitch App 1')).toBeInTheDocument();
    });

    it('renders the Apps in Development section grouped by sectors', () => {
        render(<DevelopersAppsPage />);

        // Test if the main header exists
        expect(screen.getByRole('heading', { level: 2, name: /Aplicaciones en Desarrollo/i })).toBeInTheDocument();

        // Check for some known sectors
        expect(screen.getByText(/1. Sector Logística y Transporte/i)).toBeInTheDocument();
        expect(screen.getByText(/4. Sector Retail y Lujo/i)).toBeInTheDocument();

        // Check if some known Apps are listed
        expect(screen.getByText('BeZhas Cargo Fingerprint')).toBeInTheDocument();
        expect(screen.getByText('BeZhas Auto-Appraiser')).toBeInTheDocument();
    });
});
