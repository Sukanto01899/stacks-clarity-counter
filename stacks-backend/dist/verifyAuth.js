"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.verifyAuth = void 0;
const config_1 = require("./config");
// Middleware to verify Chainhook auth
const verifyAuth = (req, res, next) => {
    if (!config_1.CHAINHOOK_AUTH_TOKEN) {
        res.status(401).json({ error: "Unauthorized" });
        return;
    }
    const authHeader = req.headers.authorization;
    const expectedHeader = `Bearer ${config_1.CHAINHOOK_AUTH_TOKEN}`;
    const tokenQuery = req.query.token;
    if (authHeader === expectedHeader) {
        next();
        return;
    }
    if (typeof tokenQuery === "string" && tokenQuery === config_1.CHAINHOOK_AUTH_TOKEN) {
        next();
        return;
    }
    if (Array.isArray(tokenQuery) && tokenQuery[0] === config_1.CHAINHOOK_AUTH_TOKEN) {
        next();
        return;
    }
    {
        res.status(401).json({ error: "Unauthorized" });
        return;
    }
};
exports.verifyAuth = verifyAuth;
