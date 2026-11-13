import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useSidebar, sidebarActions, __resetSidebar } from './sidebarStore';

describe('sidebarStore', () => {
  beforeEach(() => { localStorage.clear(); __resetSidebar({ open: true, collapsed: false }); });

  it('dos consumidores ven el mismo estado (ya no hay un useState por layout)', () => {
    const a = renderHook(() => useSidebar());
    const b = renderHook(() => useSidebar());
    act(() => sidebarActions.toggleOpen());
    expect(a.result.current.open).toBe(false);
    expect(b.result.current.open).toBe(false);
  });

  it('colapsar se recuerda en localStorage', () => {
    act(() => sidebarActions.setCollapsed(true));
    expect(localStorage.getItem('bezhas.sidebar.collapsed')).toBe('1');
    act(() => sidebarActions.toggleCollapsed());
    expect(localStorage.getItem('bezhas.sidebar.collapsed')).toBe('0');
  });

  it('cerrar y reabrir el cajón del móvil funciona', () => {
    const { result } = renderHook(() => useSidebar());
    act(() => result.current.setOpen(false));
    expect(result.current.open).toBe(false);
    act(() => result.current.toggleOpen());
    expect(result.current.open).toBe(true);
  });
});
