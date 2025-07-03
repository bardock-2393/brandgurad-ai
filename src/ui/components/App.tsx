// To support: system="express" scale="medium" color="light"
// import these spectrum web components modules:
import "@spectrum-web-components/theme/express/scale-medium.js";
import "@spectrum-web-components/theme/express/theme-light.js";

// To learn more about using "swc-react" visit:
// https://opensource.adobe.com/spectrum-web-components/using-swc-react/
import { Button } from "@swc-react/button";
import { Theme } from "@swc-react/theme";
import React, { useEffect, useState } from "react";
import { DocumentSandboxApi } from "../../models/DocumentSandboxApi";
import "./App.css";

import { AddOnSDKAPI } from "https://new.express.adobe.com/static/add-on-sdk/sdk.js";

const App = ({ addOnUISdk, sandboxProxy }: { addOnUISdk: AddOnSDKAPI; sandboxProxy: DocumentSandboxApi }) => {
    const [pageMeta, setPageMeta] = useState<any>(null);
    const [elementsMeta, setElementsMeta] = useState<any[]>([]);
    const [error, setError] = useState<string | null>(null);
    const [pngUrl, setPngUrl] = useState<string | null>(null);
    const [videoUrl, setVideoUrl] = useState<string | null>(null);
    const [noVideoOrGif, setNoVideoOrGif] = useState<boolean>(false);

    useEffect(() => {
        async function fetchMetaAndRenditions() {
            try {
                const metaArr = await addOnUISdk.app.document.getPagesMetadata({
                    range: addOnUISdk.constants.Range.currentPage
                });
                setPageMeta(metaArr && metaArr.length > 0 ? metaArr[0] : null);
                const elements = await sandboxProxy.getCurrentPageElementsMeta();
                setElementsMeta(elements);
                // PNG rendition
                const renditionOptionsPng = {
                    range: addOnUISdk.constants.Range.currentPage,
                    format: addOnUISdk.constants.RenditionFormat.png,
                };
                const renditionsPng = await addOnUISdk.app.document.createRenditions(
                    renditionOptionsPng,
                    addOnUISdk.constants.RenditionIntent.preview
                );
                if (renditionsPng && renditionsPng.length > 0) {
                    const url = URL.createObjectURL(renditionsPng[0].blob);
                    setPngUrl(url);
                } else {
                    setError("No PNG rendition returned");
                }
                // MP4 rendition
                let foundVideo = false;
                const renditionOptionsMp4 = {
                    range: addOnUISdk.constants.Range.currentPage,
                    format: addOnUISdk.constants.RenditionFormat.mp4,
                };
                try {
                    const renditionsMp4 = await addOnUISdk.app.document.createRenditions(
                        renditionOptionsMp4,
                        addOnUISdk.constants.RenditionIntent.preview
                    );
                    if (renditionsMp4 && renditionsMp4.length > 0) {
                        const vurl = URL.createObjectURL(renditionsMp4[0].blob);
                        setVideoUrl(vurl);
                        foundVideo = true;
                    } else {
                        setVideoUrl(null);
                    }
                } catch (err) {
                    setVideoUrl(null);
                }
                setNoVideoOrGif(!foundVideo);
            } catch (err: any) {
                setError(err?.message || "Failed to fetch metadata or renditions");
            }
        }
        fetchMetaAndRenditions();
    }, [addOnUISdk, sandboxProxy]);

    return (
        // Please note that the below "<Theme>" component does not react to theme changes in Express.
        // You may use "addOnUISdk.app.ui.theme" to get the current theme and react accordingly.
        <Theme system="express" scale="medium" color="light">
            <div className="container">
                <h2>Current Page Metadata</h2>
                {error && <div style={{ color: 'red' }}>{error}</div>}
                {pageMeta ? (
                    <pre style={{ textAlign: 'left', background: '#f4f4f4', padding: '12px', borderRadius: '8px', overflowX: 'auto' }}>
                        {JSON.stringify(pageMeta, null, 2)}
                    </pre>
                ) : (
                    !error && <div>Loading...</div>
                )}
                <h2 style={{ marginTop: 24 }}>Elements on Current Page</h2>
                {elementsMeta.length > 0 ? (
                    elementsMeta
                        // .filter(el => { ... }) // REMOVE FILTER TEMPORARILY
                        .map((el, idx) => {
                            // Log all types for debugging
                            console.log('Element type:', el.type, el);
                            let label = '';
                            if (el.type && el.type.toLowerCase().includes('text')) {
                                label = `Text: "${el.text ?? ''}"`;
                            } else if (el.type && (el.type.toLowerCase().includes('image') || el.type.toLowerCase().includes('media'))) {
                                label = 'Image';
                            } else if (el.type && el.type.toLowerCase().includes('rectangle')) {
                                label = 'Rectangle';
                            } else {
                                label = el.type || 'Element';
                            }
                            return (
                                <div key={el.id || idx} style={{ marginBottom: 16 }}>
                                    <div style={{ fontWeight: 'bold', marginBottom: 4 }}>{label}</div>
                                    <pre style={{ textAlign: 'left', background: '#f9f9f9', padding: '8px', borderRadius: '6px', marginBottom: 0, overflowX: 'auto' }}>
                                        {JSON.stringify(el, null, 2)}
                                    </pre>
                                </div>
                            );
                        })
                ) : (
                    !error && <div>No elements found or loading...</div>
                )}
                {/* Show the PNG if available */}
                {pngUrl && (
                    <div style={{ marginTop: 24 }}>
                        <h3>Page PNG Preview</h3>
                        <img src={pngUrl} alt="Page PNG" style={{ maxWidth: '100%', border: '1px solid #ccc', borderRadius: 8 }} />
                    </div>
                )}
                {/* Show the video/animation if available, directly below PNG */}
                {videoUrl && (
                    <div style={{ marginTop: 24 }}>
                        <h3>Page Video/Animation Preview (MP4)</h3>
                        <video src={videoUrl} controls style={{ maxWidth: '100%', border: '1px solid #ccc', borderRadius: 8 }} />
                    </div>
                )}
                {/* GIF not supported */}
                <div style={{ marginTop: 24, color: '#888' }}>
                    <em>GIF export is not supported by the SDK. Only PNG, MP4, JPG, and PDF are available.</em>
                </div>
                {noVideoOrGif && (
                    <div style={{ marginTop: 24, color: '#888' }}>
                        <em>No video or animation output available for this page.</em>
                    </div>
                )}
            </div>
        </Theme>
    );
};

export default App;
