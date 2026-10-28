export interface WorkflowSummary {
  id: string;
  name: string;
  widthMeters: number;
  heightMeters: number;
  createdAt: string;
  updatedAt: string;
}

export interface WorkflowPageResult {
  items: WorkflowSummary[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}
