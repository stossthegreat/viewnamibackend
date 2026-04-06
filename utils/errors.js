// backend/utils/errors.js

export class AppError extends Error {
  constructor(message, statusCode) {
    super(message);
    this.statusCode = statusCode || 500;
    this.status = `${statusCode}`.startsWith("4") ? "fail" : "error";
    this.isOperational = true;

    Error.captureStackTrace(this, this.constructor);
  }
}

export function globalErrorHandler(err, req, res, next) {
  console.error("🔥 GLOBAL ERROR:", err);

  if (err.isOperational) {
    return res.status(err.statusCode).json({
      status: err.status,
      message: err.message,
    });
  }

  // Programming or unknown error
  return res.status(500).json({
    status: "error",
    message: "Something went wrong.",
  });
}

