import { describe, expect, it } from 'vitest';
import {
  absoluteBounds,
  findOverlap,
  floorsFor,
  intersectionRatio,
  isDescendant,
  containingArea,
  localPositionFor,
  snapToGuides,
} from './spatial';
import type { MapElement } from './types';
const room = (
  id: string,
  parentId: string | null,
  x: number,
  y: number,
  width: number,
  height: number,
  level = 0,
): MapElement => ({
  id,
  parentId,
  deviceId: null,
  kind: 'AREA',
  name: id,
  iconKey: null,
  xMeters: x,
  yMeters: y,
  widthMeters: width,
  heightMeters: height,
  level,
});
describe('spatial room editor', () => {
  it('magnetizes edges, corners and centers with meter-scaled tolerance', () => {
    const terrain = { x: 0, y: 0, w: 100, h: 80 };
    expect(snapToGuides({ x: 0.12, y: 0.18, w: 10, h: 8 }, [terrain], 0.3)).toMatchObject({
      x: 0,
      y: 0,
      vertical: 0,
      horizontal: 0,
    });
    expect(snapToGuides({ x: 45.1, y: 35, w: 10, h: 10 }, [terrain], 0.3).x).toBe(45);
    expect(snapToGuides({ x: 2, y: 3, w: 10, h: 8 }, [terrain], 0.3)).toMatchObject({
      x: 2,
      y: 3,
      vertical: null,
      horizontal: null,
    });
  });

  it('uses absolute positions for nested sectors', () => {
    const a = room('a', null, 5, 6, 30, 20),
      b = room('b', 'a', 2, 3, 10, 8);
    expect(absoluteBounds([a, b], b)).toEqual({ x: 7, y: 9, w: 10, h: 8 });
    expect(isDescendant([a, b], 'b', 'a')).toBe(true);
    expect(isDescendant([a, b], 'a', 'b')).toBe(false);
  });
  it('finds overlap but never proposes a descendant as target', () => {
    const first = room('first', null, 0, 0, 20, 20),
      second = room('second', null, 40, 40, 10, 10);
    expect(findOverlap([first, second], second, 8, 8)?.id).toBe('first');
    expect(findOverlap([first, second], second, 60, 60)).toBeNull();
    expect(intersectionRatio({ x: 1, y: 1, w: 2, h: 2 }, { x: 10, y: 10, w: 2, h: 2 })).toBe(0);
  });
  it('treats identical footprints with different levels as independent navigable floors', () => {
    const ground = room('ground', null, 10, 15, 20, 12, 0),
      upper = room('upper', null, 10, 15, 20, 12, 1);
    const floors = floorsFor([upper, ground], upper);
    expect(floors.map((f) => f.id)).toEqual(['ground', 'upper']);
    expect(floors[0].level).toBe(0);
  });
  it('does not merge arbitrary overlapping areas into floors', () => {
    const a = room('a', null, 5, 5, 18, 12),
      b = room('b', null, 8, 7, 18, 12);
    expect(floorsFor([a, b], a)).toHaveLength(0);
  });
  it('links dropped devices to the deepest visible room and preserves world positions on reparent', () => {
    const parent = room('territory-sector', null, 10, 8, 40, 30);
    const child = room('office', 'territory-sector', 4, 3, 12, 10);
    const item = {
      ...room('pc', null, 16, 13, 2, 2),
      kind: 'DEVICE' as const,
      deviceId: 'device-1',
    };
    const items = [parent, child, item];
    expect(containingArea(items, { x: 17, y: 14 })?.id).toBe('office');
    const newLocal = localPositionFor(items, { x: 16, y: 13 }, 'office');
    expect(newLocal).toEqual({ x: 2, y: 2 });
    expect(
      absoluteBounds(items, {
        ...item,
        parentId: 'office',
        xMeters: newLocal.x,
        yMeters: newLocal.y,
      }),
    ).toEqual({ x: 16, y: 13, w: 2, h: 2 });
  });
  it('does not allow a container to become its own descendant', () => {
    const parent = room('a', null, 0, 0, 20, 20),
      child = room('b', 'a', 2, 2, 8, 8);
    expect(containingArea([parent, child], { x: 5, y: 5 }, 'a')).toBeNull();
  });
  it('respects hidden rooms and visible floor selection', () => {
    const lower = room('lower', null, 1, 1, 20, 20, 0),
      upper = room('upper', null, 1, 1, 20, 20, 1);
    expect(
      containingArea([lower, upper], { x: 5, y: 5 }, undefined, {
        'root|1.00|1.00|20.00|20.00': 'lower',
      })?.id,
    ).toBe('lower');
    expect(
      containingArea([{ ...lower, hidden: true }, upper], { x: 5, y: 5 }, undefined, {
        'root|1.00|1.00|20.00|20.00': 'lower',
      }),
    ).toBeNull();
  });
});
