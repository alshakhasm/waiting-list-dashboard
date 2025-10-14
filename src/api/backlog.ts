import { BacklogService } from '../services/backlogService';

export const listBacklog = BacklogService.list;
export const softRemoveBacklog = BacklogService.softRemove;
export const updateBacklog = BacklogService.update;
