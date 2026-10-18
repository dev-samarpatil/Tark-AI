import { mockDatabase } from '../data/mockDatabase.js';

export const getSession = (req, res) => {
  res.json({
    success: true,
    data: mockDatabase.candidate
  });
};

export const updateSessionStatus = (req, res) => {
  const { status } = req.body;
  if (status) {
    mockDatabase.candidate.status = status;
  }
  res.json({
    success: true,
    data: mockDatabase.candidate
  });
};
