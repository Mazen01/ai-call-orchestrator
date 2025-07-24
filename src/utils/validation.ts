import Joi from 'joi';

export const createCallSchema = Joi.object({
  to: Joi.string()
    .pattern(/^\+\d{10,15}$/)
    .required()
    .messages({
      'string.pattern.base': 'Phone number must be in international format (e.g., +966501234567)'
    }),
  scriptId: Joi.string()
    .min(1)
    .max(100)
    .required(),
  metadata: Joi.object()
    .optional()
});

export const updateCallSchema = Joi.object({
  payload: Joi.object({
    to: Joi.string()
      .pattern(/^\+\d{10,15}$/)
      .optional()
      .messages({
        'string.pattern.base': 'Phone number must be in international format (e.g., +966501234567)'
      }),
    scriptId: Joi.string()
      .min(1)
      .max(100)
      .optional(),
    metadata: Joi.object()
      .optional()
  }).optional()
});

export const webhookPayloadSchema = Joi.object({
  callId: Joi.string()
    .required()
    .messages({
      'string.empty': 'callId is required'
    }),
  status: Joi.string()
    .valid('COMPLETED', 'FAILED', 'BUSY', 'NO_ANSWER')
    .required(),
  durationSec: Joi.number()
    .integer()
    .min(0)
    .optional(),
  completedAt: Joi.string()
    .isoDate()
    .required()
});

export const validateCreateCall = (data: any) => {
  return createCallSchema.validate(data, { abortEarly: false });
};

export const validateUpdateCall = (data: any) => {
  return updateCallSchema.validate(data, { abortEarly: false });
};

export const validateWebhookPayload = (data: any) => {
  return webhookPayloadSchema.validate(data, { abortEarly: false });
};