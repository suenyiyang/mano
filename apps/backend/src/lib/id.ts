import { randomUUID } from "node:crypto";

export const generateId = () => randomUUID();

export const generateResponseId = () => `resp_${randomUUID()}`;
