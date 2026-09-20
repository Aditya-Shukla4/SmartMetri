"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createNotification = void 0;
const createNotification = (tx, userId, type, title, message) => tx.notification.create({ data: { userId, type, title, message } });
exports.createNotification = createNotification;
