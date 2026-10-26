'use client';
import { useState } from 'react';
import { Group, Rect, Text, Circle } from 'react-konva';
import { VectorIcon } from '@/components/vector-icons';
import { DEFAULT_ICONS, type DeviceKind, type MapElement } from '@/lib/types';
import type { DeviceHealth } from '@infra/contracts';
import { healthColor, healthLabel } from '@/features/monitoring/status';
const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
export function EditorNode({
  el,
  health,
  connecting,
  selected,
  unit,
  zoom,
  onSelect,
  onHover,
  onMove,
  onDragging,
  onEdit,
  floorLabel,
  onSwitchFloor,
  children,
}: {
  el: MapElement;
  health?: DeviceHealth;
  connecting: boolean;
  selected: boolean;
  unit: number;
  zoom: number;
  onSelect: () => void;
  onHover: (enter: boolean) => void;
  onUpdate: (change: Partial<MapElement>) => void;
  onMove: (x: number, y: number) => void;
  onDragging: (x: number, y: number) => { x: number; y: number };
  onEdit: () => void;
  floorLabel: string | null;
  onSwitchFloor: () => void;
  children: React.ReactNode;
}) {
  const [hovered, setHovered] = useState(false);
  const area = el.kind === 'AREA';
  // Rooms have real-world size; device markers are screen-space symbols and must never balloon with zoom.
  const displayUnit = area ? unit : 20;
  const w = el.widthMeters * displayUnit,
    h = el.heightMeters * displayUnit;
  const icon =
    el.iconKey ?? (area ? 'door-open' : DEFAULT_ICONS[(el.device?.kind ?? 'OTHER') as DeviceKind]);
  const glyphSize = clamp(Math.min(w, h) * 0.54, 23, 38);
  return (
    <Group
      name="infra-node"
      x={el.xMeters * unit}
      y={el.yMeters * unit}
      scaleX={area ? 1 : 1 / zoom}
      scaleY={area ? 1 : 1 / zoom}
      draggable={!el.locked && !connecting}
      onDragMove={(event) => {
        if (event.target !== event.currentTarget) return;
        const target = event.target;
        const snap = onDragging(target.x() / unit, target.y() / unit);
        target.position({ x: snap.x * unit, y: snap.y * unit });
      }}
      onMouseEnter={() => {
        setHovered(true);
        onHover(true);
      }}
      onMouseLeave={() => {
        setHovered(false);
        onHover(false);
      }}
      onMouseDown={(event) => {
        event.cancelBubble = true;
        onSelect();
      }}
      onTap={(event) => {
        event.cancelBubble = true;
        onSelect();
      }}
      onDragEnd={(event) => {
        if (event.target !== event.currentTarget) return;
        onMove(
          Number((event.target.x() / unit).toFixed(3)),
          Number((event.target.y() / unit).toFixed(3)),
        );
      }}
    >
      {area ? (
        <>
          <Rect
            width={w}
            height={h}
            cornerRadius={10}
            fill="#ffffff"
            stroke={selected ? '#777980' : hovered ? '#a5a6aa' : '#d5d6d9'}
            strokeWidth={selected ? 2 : 1.2}
          />
          <Rect
            x={4 / zoom}
            y={4 / zoom}
            width={Math.max(1, w - 8 / zoom)}
            height={30 / zoom}
            cornerRadius={6 / zoom}
            fill="#fafafa"
            listening={false}
          />
          <Group x={11 / zoom} y={8 / zoom} scaleX={1 / zoom} scaleY={1 / zoom}>
            <VectorIcon name={icon} x={0} y={0} size={19} color="#5d6067" />
            <Text
              text={el.name}
              x={25}
              y={3}
              fontSize={12}
              fontStyle="bold"
              width={Math.max(30, w * zoom - 115)}
              ellipsis
              fill="#2b2c30"
              onClick={(event) => {
                event.cancelBubble = true;
                onEdit();
              }}
              onTap={(event) => {
                event.cancelBubble = true;
                onEdit();
              }}
            />
          </Group>
          {children}
          {floorLabel && (
            <Group
              x={Math.max(40 / zoom, w - 100 / zoom)}
              y={7 / zoom}
              scaleX={1 / zoom}
              scaleY={1 / zoom}
              onClick={(event) => {
                event.cancelBubble = true;
                onSwitchFloor();
              }}
              onTap={(event) => {
                event.cancelBubble = true;
                onSwitchFloor();
              }}
              onMouseDown={(event) => {
                event.cancelBubble = true;
              }}
            >
              <Rect
                width={56}
                height={22}
                fill="#fff"
                stroke="#d5d6db"
                strokeWidth={1}
                cornerRadius={9}
              />
              <Text
                text={`↕ ${floorLabel}`}
                x={5}
                y={5}
                fontStyle="bold"
                fontSize={11}
                width={48}
                align="center"
                fill="#4d4d53"
              />
            </Group>
          )}
        </>
      ) : (
        <>
          <Rect
            width={w}
            height={h}
            cornerRadius={9}
            fill="#fff"
            stroke={selected ? '#74767b' : hovered ? '#a7a9af' : '#d9dade'}
            strokeWidth={selected ? 2.5 : 1.2}
            shadowBlur={7}
            shadowColor="#161618"
            shadowOpacity={0.07}
          />
          <VectorIcon
            name={icon}
            x={(w - glyphSize) / 2}
            y={(h - glyphSize) / 2}
            size={glyphSize}
            color={el.device?.status === 'OFFLINE' ? '#c24b46' : '#303038'}
          />
          <Circle
            x={w - 5}
            y={5}
            radius={4.5}
            stroke="#fff"
            strokeWidth={1.5}
            fill={healthColor[health?.state ?? 'DISABLED']}
            listening={false}
          />
          <Text
            text={el.name}
            x={-35}
            y={h + 5}
            width={w + 70}
            align="center"
            fontSize={11}
            fill="#38393e"
            onClick={(event) => {
              event.cancelBubble = true;
              onEdit();
            }}
            onTap={(event) => {
              event.cancelBubble = true;
              onEdit();
            }}
          />
          {hovered && !selected && el.device && (
            <Group x={w + 9} y={-4} listening={false}>
              <Rect
                width={225}
                height={155}
                cornerRadius={10}
                fill="#fff"
                stroke="#e0e0e0"
                shadowBlur={16}
                shadowOpacity={0.13}
              />
              <Text
                x={12}
                y={10}
                width={201}
                fontSize={12}
                fontStyle="bold"
                fill="#28292d"
                text={el.name}
              />
              <Text
                x={12}
                y={30}
                width={201}
                fontSize={11}
                lineHeight={1.5}
                fill="#737478"
                text={`Tipo: ${el.device.kind} | Manual: ${el.device.status}\nIP: ${el.device.ipAddress ?? 'Não informado'}\nModelo: ${el.device.model ?? 'Não informado'}\nMonitor: ${healthLabel[health?.state ?? 'DISABLED']}\n${health?.summary ?? 'Habilite na aba Monitorar.'}`}
              />
            </Group>
          )}
        </>
      )}
    </Group>
  );
}
