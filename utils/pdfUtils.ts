import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

/**
 * Adds page numbers, tile coordinates, and a timestamp to each page of the PDF.
 */
const addPdfFooters = (pdf: jsPDF, currentPage: number, totalPages: number, tileCoords: string, margin: number): void => {
    const pdfHeight = pdf.internal.pageSize.getHeight();
    const pdfWidth = pdf.internal.pageSize.getWidth();
    pdf.setFontSize(8);
    pdf.setTextColor(150);

    // Date/Time on the left
    const dateTime = new Date().toLocaleString();
    pdf.text(dateTime, margin, pdfHeight - 5);

    // Tile Coordinates in the center
    const tileCoordsText = `Tile: ${tileCoords}`;
    const tileTextWidth = pdf.getStringUnitWidth(tileCoordsText) * pdf.getFontSize() / pdf.internal.scaleFactor;
    pdf.text(tileCoordsText, (pdfWidth / 2) - (tileTextWidth / 2), pdfHeight - 5);

    // Page number on the right
    const pageNumText = `Page ${currentPage} of ${totalPages}`;
    const textWidth = pdf.getStringUnitWidth(pageNumText) * pdf.getFontSize() / pdf.internal.scaleFactor;
    pdf.text(pageNumText, pdfWidth - margin - textWidth, pdfHeight - 5);
};

/**
 * Generates a paginated, tiled PDF from a large HTML element.
 * The element is captured once in full, then sliced into page-sized tiles
 * to avoid canvas size limits and ensure correct pagination.
 *
 * @param element The HTML element to capture.
 * @param fileName The base name for the downloaded PDF file.
 * @param orientation The page orientation ('p' for portrait, 'l' for landscape).
 */
export const generatePdf = async (element: HTMLElement, fileName: string, orientation: 'p' | 'l' = 'p') => {
    if (!element) return;

    try {
        const pdf = new jsPDF(orientation, 'mm', 'a4');
        const pdfWidth = pdf.internal.pageSize.getWidth();
        const pdfHeight = pdf.internal.pageSize.getHeight();
        const margin = 10;
        const scale = 2; // Render at 2x resolution for clarity

        const contentWidthMM = pdfWidth - margin * 2;
        const contentHeightMM = pdfHeight - margin * 2;

        const dpi = 72 * scale;
        const mmToPx = (mm: number) => (mm * dpi / 25.4);

        const tileWidthPx = mmToPx(contentWidthMM);
        const tileHeightPx = mmToPx(contentHeightMM);
        
        // Capture the entire element onto a single, large canvas
        const fullCanvas = await html2canvas(element, {
            scale: scale,
            useCORS: true,
            backgroundColor: '#ffffff',
            width: element.scrollWidth,
            height: element.scrollHeight,
            windowWidth: element.scrollWidth,
            windowHeight: element.scrollHeight,
            onclone: (doc) => {
                doc.documentElement.classList.remove('dark');
                const style = doc.createElement('style');
                style.innerHTML = `
                    body, body * { color: #1f2937 !important; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
                    .bg-male { background-color: #eff6ff !important; }
                    .bg-female { background-color: #fce7f3 !important; }
                    .no-print { display: none !important; }
                    * { box-shadow: none !important; text-shadow: none !important; transition: none !important; animation: none !important; }
                `;
                doc.head.appendChild(style);
            }
        });

        const totalWidthPx = fullCanvas.width;
        const totalHeightPx = fullCanvas.height;

        const numPagesHorz = Math.ceil(totalWidthPx / tileWidthPx);
        const numPagesVert = Math.ceil(totalHeightPx / tileHeightPx);
        const totalPages = numPagesHorz * numPagesVert;
        
        let pageCounter = 0;
        for (let y = 0; y < numPagesVert; y++) {
            for (let x = 0; x < numPagesHorz; x++) {
                pageCounter++;
                if (pageCounter > 1) {
                    pdf.addPage(undefined, orientation);
                }

                // Create a temporary canvas for each tile
                const tileCanvas = document.createElement('canvas');
                tileCanvas.width = tileWidthPx;
                tileCanvas.height = tileHeightPx;
                const tileCtx = tileCanvas.getContext('2d');
                if (!tileCtx) throw new Error("Could not get context for tile canvas");

                // Calculate the source coordinates for the slice from the full canvas
                const sx = x * tileWidthPx;
                const sy = y * tileHeightPx;
                
                // Draw the correct slice from the full canvas onto the tile canvas
                tileCtx.drawImage(
                    fullCanvas,
                    sx, sy,           // Source x, y
                    tileWidthPx, tileHeightPx, // Source width, height
                    0, 0,             // Destination x, y
                    tileWidthPx, tileHeightPx  // Destination width, height
                );
                
                const imgData = tileCanvas.toDataURL('image/jpeg', 0.95);
                pdf.addImage(imgData, 'JPEG', margin, margin, contentWidthMM, contentHeightMM);

                // Add alignment guides
                pdf.setDrawColor(200, 200, 200);
                pdf.setLineDashPattern([1, 1], 0);

                if (y > 0) pdf.line(margin, margin, contentWidthMM + margin, margin); // Top guide
                if (y < numPagesVert - 1) pdf.line(margin, contentHeightMM + margin, contentWidthMM + margin, contentHeightMM + margin); // Bottom guide
                if (x > 0) pdf.line(margin, margin, margin, contentHeightMM + margin); // Left guide
                if (x < numPagesHorz - 1) pdf.line(contentWidthMM + margin, margin, contentWidthMM + margin, contentHeightMM + margin); // Right guide

                pdf.setLineDashPattern([], 0);

                const tileCoords = `${String.fromCharCode(65 + y)}${x + 1}`;
                addPdfFooters(pdf, pageCounter, totalPages, tileCoords, margin);
            }
        }
        
        pdf.save(`${fileName.replace(/\s/g, '_')}.pdf`);

    } catch (error) {
        console.error("Error generating PDF:", error);
        alert("Sorry, an error occurred while generating the PDF. Please check the console.");
    }
};