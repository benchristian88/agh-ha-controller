let nextEditorRowKey = 0;

export function createEditorRowKey(kind: string) {
  nextEditorRowKey += 1;
  return `${kind}-${nextEditorRowKey}`;
}

export {
  formatTimeOfDay,
  parseTimeOfDay,
} from "../../components/ScheduleEditor";
