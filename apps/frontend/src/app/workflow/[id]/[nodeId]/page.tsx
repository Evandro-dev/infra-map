import { DeviceWorkbench } from '@/features/devices/components/device-workbench';

export default async function DevicePage({
  params,
}: {
  params: Promise<{ id: string; nodeId: string }>;
}) {
  const { id, nodeId } = await params;
  return <DeviceWorkbench mapId={id} nodeId={nodeId} />;
}
