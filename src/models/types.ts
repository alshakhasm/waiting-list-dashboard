export type ID = string;

export type Priority = 'low' | 'medium' | 'high';
export type TriageStatus = 'new' | 'reviewed' | 'ready' | 'scheduled' | 'cancelled';

export type CaseTypeId = ID;
export type SurgeonId = ID;
export type ORRoomId = ID;
export type WaitingListItemId = ID;
export type ScheduleEntryId = ID;
export type MappingProfileId = ID;
export type ImportBatchId = ID;

export type CaseType = {
  id: CaseTypeId;
  name: string;
  colorCode: string;
  description?: string;
};

export type WaitingListItem = {
  id: WaitingListItemId;
  patientName: string;
  mrn: string;
  caseTypeId: CaseTypeId;
  procedure: string;
  estDurationMin: number;
  surgeonId?: SurgeonId;
  priority?: Priority;
  equipment?: string;
  triageStatus?: TriageStatus;
  notes?: string;
  createdAt: string;
};

export type ORRoom = {
  id: ORRoomId;
  name: string;
  location?: string;
  capabilities?: string[];
};

export type Surgeon = {
  id: SurgeonId;
  name: string;
  specialty?: string;
  availability?: Array<{ date: string; start: string; end: string }>;
};

export type ScheduleEntry = {
  id: ScheduleEntryId;
  waitingListItemId: WaitingListItemId;
  roomId: ORRoomId;
  surgeonId: SurgeonId;
  date: string; // YYYY-MM-DD
  startTime: string; // HH:MM
  endTime: string; // HH:MM
  status: 'tentative' | 'scheduled' | 'completed' | 'cancelled';
  notes?: string;
  updatedAt: string;
  version: number;
};

export type MappingProfile = {
  id: MappingProfileId;
  name: string;
  owner: string;
  fieldMappings: Record<string, string>;
  requiredFieldsPolicy?: string;
};

export type ImportBatch = {
  id: ImportBatchId;
  fileName: string;
  importedAt: string;
  mappingProfileId?: MappingProfileId;
  countsCreated: number;
  countsUpdated: number;
  countsSkipped: number;
  errors: string[];
};

export type ExportArtifact = {
  id: string;
  dateRange: string;
  includedFields: string[];
  generatedAt: string;
  format: 'pdf' | 'xlsx';
};
