let nextEditorRowKey = 0;

export function createEditorRowKey(kind: string) {
  nextEditorRowKey += 1;
  return `${kind}-${nextEditorRowKey}`;
}

export function formatTimeOfDay(milliseconds: number) {
  const totalMinutes = Math.round(milliseconds / 60_000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

export function parseTimeOfDay(value: string) {
  const [hours = 0, minutes = 0] = value.split(":").map(Number);
  return (hours * 60 + minutes) * 60_000;
}
