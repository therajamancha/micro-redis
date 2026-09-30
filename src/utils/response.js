export const successResponse = (res, data = null, message = 'Success', statusCode = 200, meta = null) => {
  const payload = {
    success: true,
    message,
    data,
  };

  if (meta) {
    payload.meta = meta;
  }

  return res.status(statusCode).json(payload);
};

export const errorResponse = (res, message = 'An error occurred', statusCode = 500, code = 'INTERNAL_ERROR', details = null) => {
  const payload = {
    success: false,
    error: {
      code,
      message,
      ...(details ? { details } : {}),
    },
  };

  return res.status(statusCode).json(payload);
};

export default {
  successResponse,
  errorResponse,
};
