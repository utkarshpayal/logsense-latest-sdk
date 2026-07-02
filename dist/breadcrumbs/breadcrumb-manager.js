"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.breadcrumbManager = exports.BreadcrumbManager = void 0;
const context_store_1 = require("../context/context-store");
const time_1 = require("../utils/time");
class BreadcrumbManager {
    globalBreadcrumbs = [];
    limit;
    constructor(limit = 100) {
        this.limit = limit;
    }
    add(breadcrumb) {
        const entry = {
            timestamp: breadcrumb.timestamp ?? (0, time_1.nowMs)(),
            message: breadcrumb.message,
            ...(breadcrumb.category !== undefined ? { category: breadcrumb.category } : {}),
            ...(breadcrumb.level !== undefined ? { level: breadcrumb.level } : {}),
            ...(breadcrumb.metadata !== undefined ? { metadata: breadcrumb.metadata } : {}),
        };
        const activeCtx = context_store_1.contextStore.get();
        if (activeCtx) {
            if (!activeCtx.metadata._breadcrumbs) {
                activeCtx.metadata._breadcrumbs = [];
            }
            const list = activeCtx.metadata._breadcrumbs;
            list.push(entry);
            if (list.length > this.limit) {
                list.shift();
            }
        }
        else {
            this.globalBreadcrumbs.push(entry);
            if (this.globalBreadcrumbs.length > this.limit) {
                this.globalBreadcrumbs.shift();
            }
        }
    }
    get() {
        const activeCtx = context_store_1.contextStore.get();
        if (activeCtx && activeCtx.metadata._breadcrumbs) {
            return activeCtx.metadata._breadcrumbs;
        }
        return this.globalBreadcrumbs;
    }
    clear() {
        const activeCtx = context_store_1.contextStore.get();
        if (activeCtx) {
            activeCtx.metadata._breadcrumbs = [];
        }
        else {
            this.globalBreadcrumbs.length = 0;
        }
    }
}
exports.BreadcrumbManager = BreadcrumbManager;
exports.breadcrumbManager = new BreadcrumbManager();
//# sourceMappingURL=breadcrumb-manager.js.map