import addOnSandboxSdk from "add-on-sdk-document-sandbox";
import { editor } from "express-document-sdk";
import { DocumentSandboxApi } from "../models/DocumentSandboxApi";

// Get the document sandbox runtime.
const { runtime } = addOnSandboxSdk.instance;

function start(): void {
    // APIs to be exposed to the UI runtime
    // i.e., to the `App.tsx` file of this add-on.
    const sandboxApi: DocumentSandboxApi = {
        async getCurrentPageElementsMeta() {
            const doc = editor.documentRoot;
            const page = doc.pages.first;
            if (!page) return [];
            const artboards = Array.from(page.artboards);
            let elements: any[] = [];
            function getNodeMeta(node: any): any {
                const meta: any = {
                    id: node.id,
                    name: node.name ?? '',
                    type: node.type,
                };
                // Geometry
                try { meta.width = node.width; } catch {}
                try { meta.height = node.height; } catch {}
                try { meta.boundsLocal = node.boundsLocal; } catch {}
                try { meta.boundsInParent = node.boundsInParent; } catch {}
                try { meta.centerPointLocal = node.centerPointLocal; } catch {}
                try { meta.topLeftLocal = node.topLeftLocal; } catch {}
                try { meta.translation = node.translation; } catch {}
                try { meta.rotation = node.rotation; } catch {}
                try { meta.rotationInScreen = node.rotationInScreen; } catch {}
                try { meta.transformMatrix = node.transformMatrix; } catch {}
                // Appearance
                try { meta.opacity = node.opacity; } catch {}
                try { meta.blendMode = node.blendMode; } catch {}
                try { meta.fill = node.fill; } catch {}
                try { meta.stroke = node.stroke; } catch {}
                try { meta.visualEffects = node.visualEffects; } catch {}
                // Structure
                try { meta.locked = node.locked; } catch {}
                try { meta.parentId = node.parent ? node.parent.id : null; } catch {}
                try { meta.childrenIds = node.children ? Array.from(node.children).map((c: any) => c.id) : undefined; } catch {}
                try { meta.allChildrenIds = node.allChildren ? Array.from(node.allChildren).map((c: any) => c.id) : undefined; } catch {}
                try { meta.maskShapeId = node.maskShape ? node.maskShape.id : undefined; } catch {}
                // Content
                if (node.type && node.type.toLowerCase().includes('text')) {
                    try { meta.text = node.fullContent ? node.fullContent.text : node.text; } catch {}
                    try { meta.textAlignment = node.textAlignment; } catch {}
                    try { meta.layout = node.layout; } catch {}
                    try {
                        if (node.fullContent) {
                            // Log the raw fullContent for debugging
                            console.log('Raw fullContent for node', node.id, node.fullContent);
                            meta.fullContent = node.fullContent ? safeClone(node.fullContent) : undefined;
                            // Explicitly extract characterStyleRanges and paragraphStyleRanges if present
                            if (node.fullContent.characterStyleRanges) {
                                meta.characterStyleRanges = safeClone(node.fullContent.characterStyleRanges);
                            }
                            if (node.fullContent.paragraphStyleRanges) {
                                meta.paragraphStyleRanges = safeClone(node.fullContent.paragraphStyleRanges);
                            }
                        }
                    } catch {}
                }
                if (node.type && node.type.toLowerCase().includes('media')) {
                    try { meta.mediaRectangleId = node.mediaRectangle ? node.mediaRectangle.id : undefined; } catch {}
                }
                if (node.type && node.type.toLowerCase().includes('image')) {
                    try { meta.width = node.width; } catch {}
                    try { meta.height = node.height; } catch {}
                }
                return meta;
            }
            function collectNodes(node: any) {
                if (!node) return;
                if (node.type !== 'ARTBOARD') {
                    elements.push(getNodeMeta(node));
                }
                const children = (node.allChildren ? Array.from(node.allChildren) : []);
                for (const child of children) {
                    collectNodes(child);
                }
            }
            for (const artboard of artboards) {
                const children = (artboard.allChildren ? Array.from(artboard.allChildren) : []);
                for (const child of children) {
                    collectNodes(child);
                }
            }
            return elements;
        }
    };

    // Expose `sandboxApi` to the UI runtime.
    runtime.exposeApi(sandboxApi);
}

// Helper to deeply clone only JSON-serializable data
function safeClone(obj) {
    if (obj === null || typeof obj !== 'object') return obj;
    if (Array.isArray(obj)) return obj.map(safeClone);
    const out = {};
    for (const key in obj) {
        if (!Object.prototype.hasOwnProperty.call(obj, key)) continue;
        const val = obj[key];
        if (typeof val === 'object' && val !== null) {
            if (val.constructor === Object || Array.isArray(val)) {
                out[key] = safeClone(val);
            }
        } else if (
            typeof val === 'string' ||
            typeof val === 'number' ||
            typeof val === 'boolean' ||
            val === null
        ) {
            out[key] = val;
        }
    }
    return out;
}

start();
