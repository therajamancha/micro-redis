import dataStructuresService from '../services/dataStructures.service.js';
import { successResponse } from '../utils/response.js';

// ================= List Controllers =================
export const pushList = async (req, res, next) => {
  try {
    const { key, values, direction, ttl } = req.body;
    const result = await dataStructuresService.listPush({ key, values, direction, ttl });
    return successResponse(res, result, 'Values pushed to list successfully', 201);
  } catch (err) {
    next(err);
  }
};

export const popList = async (req, res, next) => {
  try {
    const { key, direction, count } = req.body;
    const result = await dataStructuresService.listPop({ key, direction, count });
    return successResponse(res, result, 'Value popped from list');
  } catch (err) {
    next(err);
  }
};

export const getListRange = async (req, res, next) => {
  try {
    const { key } = req.params;
    const { start = 0, stop = -1 } = req.query;
    const result = await dataStructuresService.listRange({ key, start, stop });
    return successResponse(res, result, 'List items retrieved successfully');
  } catch (err) {
    next(err);
  }
};

// ================= Set Controllers =================
export const addSet = async (req, res, next) => {
  try {
    const { key, members, ttl } = req.body;
    const result = await dataStructuresService.setAdd({ key, members, ttl });
    return successResponse(res, result, 'Members added to set', 201);
  } catch (err) {
    next(err);
  }
};

export const getSetMembers = async (req, res, next) => {
  try {
    const { key } = req.params;
    const result = await dataStructuresService.setMembers(key);
    return successResponse(res, result, 'Set members retrieved');
  } catch (err) {
    next(err);
  }
};

export const checkSetMember = async (req, res, next) => {
  try {
    const { key, member } = req.body;
    const result = await dataStructuresService.setIsMember(key, member);
    return successResponse(res, result, 'Membership check completed');
  } catch (err) {
    next(err);
  }
};

export const removeSetMembers = async (req, res, next) => {
  try {
    const { key, members } = req.body;
    const result = await dataStructuresService.setRemove(key, members);
    return successResponse(res, result, 'Members removed from set');
  } catch (err) {
    next(err);
  }
};

// ================= Sorted Set Controllers =================
export const addZSet = async (req, res, next) => {
  try {
    const { key, entries, ttl } = req.body;
    const result = await dataStructuresService.zsetAdd({ key, entries, ttl });
    return successResponse(res, result, 'Entries added to sorted set', 201);
  } catch (err) {
    next(err);
  }
};

export const getZSetRange = async (req, res, next) => {
  try {
    const { key } = req.params;
    const { start = 0, stop = -1, reverse = 'false' } = req.query;
    const isReverse = reverse === 'true' || reverse === '1';
    const result = await dataStructuresService.zsetRange({ key, start, stop, reverse: isReverse });
    return successResponse(res, result, 'Sorted set range retrieved');
  } catch (err) {
    next(err);
  }
};

export const getZSetScore = async (req, res, next) => {
  try {
    const { key, member } = req.params;
    const result = await dataStructuresService.zsetScore(key, member);
    return successResponse(res, result, 'Member score retrieved');
  } catch (err) {
    next(err);
  }
};

// ================= Stream Controllers =================
export const addStreamEntry = async (req, res, next) => {
  try {
    const { key, data, id, maxLen, ttl } = req.body;
    const result = await dataStructuresService.streamAdd({ key, data, id, maxLen, ttl });
    return successResponse(res, result, 'Entry added to stream', 201);
  } catch (err) {
    next(err);
  }
};

export const readStreamEntries = async (req, res, next) => {
  try {
    const { key } = req.params;
    const { count = 50, lastId = '0-0' } = req.query;
    const result = await dataStructuresService.streamRead({ key, count, lastId });
    return successResponse(res, result, 'Stream entries retrieved');
  } catch (err) {
    next(err);
  }
};

export default {
  pushList,
  popList,
  getListRange,
  addSet,
  getSetMembers,
  checkSetMember,
  removeSetMembers,
  addZSet,
  getZSetRange,
  getZSetScore,
  addStreamEntry,
  readStreamEntries,
};
