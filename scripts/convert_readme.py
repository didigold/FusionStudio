import os
import sys
import fitz  # PyMuPDF
from markdown_it import MarkdownIt

def main():
    current_dir = os.path.dirname(os.path.abspath(__file__))
    project_root = os.path.abspath(os.path.join(current_dir, ".."))
    
    readme_path = os.path.join(project_root, "README.md")
    pdf_path = os.path.join(project_root, "FusionStudio_Pro_Manual.pdf")
    
    if not os.path.exists(readme_path):
        print(f"[ERROR] README.md not found at {readme_path}")
        return
        
    print(f"Reading README.md from {readme_path}...")
    with open(readme_path, "r", encoding="utf-8") as f:
        readme_text = f.read()
        
    # Convert markdown to HTML
    print("Converting Markdown to HTML...")
    md = MarkdownIt("commonmark").enable("table").enable("strikethrough")
    html_body = md.render(readme_text)
    
    # Wrap with basic document structure
    html_content = f"""<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
</head>
<body>
{html_body}
</body>
</html>"""
    
    # Premium styled CSS for PDF
    css = """
    body {
        font-family: sans-serif;
        font-size: 10pt;
        line-height: 1.5;
        color: #2c3e50;
    }
    h1 {
        font-size: 20pt;
        font-weight: bold;
        color: #2c3e50;
        margin-top: 25px;
        margin-bottom: 12px;
        border-bottom: 2px solid #3498db;
        padding-bottom: 6px;
    }
    h2 {
        font-size: 14pt;
        font-weight: bold;
        color: #2980b9;
        margin-top: 20px;
        margin-bottom: 10px;
        border-bottom: 1px solid #ecf0f1;
        padding-bottom: 4px;
    }
    h3 {
        font-size: 11.5pt;
        font-weight: bold;
        color: #34495e;
        margin-top: 15px;
        margin-bottom: 8px;
    }
    p {
        margin-bottom: 10px;
        text-align: justify;
    }
    ul, ol {
        margin-left: 20px;
        margin-bottom: 10px;
    }
    li {
        margin-bottom: 4px;
    }
    code {
        font-family: monospace;
        background-color: #f8f9fa;
        color: #e83e8c;
        padding: 1px 3px;
        font-size: 9pt;
        border-radius: 3px;
    }
    pre {
        background-color: #f8f9fa;
        border: 1px solid #e9ecef;
        border-left: 4px solid #6c757d;
        padding: 10px;
        border-radius: 4px;
        margin-bottom: 12px;
        overflow: auto;
    }
    pre code {
        background-color: transparent;
        color: #212529;
        padding: 0;
        font-size: 8.5pt;
        border-radius: 0;
    }
    table {
        border-collapse: collapse;
        width: 100%;
        margin-top: 10px;
        margin-bottom: 15px;
        font-size: 9pt;
    }
    th, td {
        border: 1px solid #dee2e6;
        padding: 8px 10px;
        text-align: left;
    }
    th {
        background-color: #e9ecef;
        font-weight: bold;
        color: #495057;
    }
    tr:nth-child(even) {
        background-color: #f8f9fa;
    }
    a {
        color: #3498db;
        text-decoration: none;
    }
    """
    
    print("Generating PDF layout using PyMuPDF Story...")
    mediabox = fitz.paper_rect("a4")  # Standard A4 page
    where = mediabox + (36, 54, -36, -54)  # Margins: 0.5 in left/right, 0.75 in top/bottom
    
    temp_write_path = pdf_path + ".tmp"
    story = fitz.Story(html=html_content, user_css=css)
    writer = fitz.DocumentWriter(temp_write_path)
    
    more = 1
    while more:
        device = writer.begin_page(mediabox)
        more, _ = story.place(where)
        story.draw(device)
        writer.end_page()
        
    writer.close()
    del writer
    import gc
    gc.collect()
    
    print(f"Temporary layout written to {temp_write_path}.")
    
    # Open the temp PDF to add running headers, footers and page numbers
    print("Formatting headers, footers, and page numbers...")
    doc = fitz.open(temp_write_path)
    num_pages = len(doc)
    
    for i, page in enumerate(doc):
        # Draw running header (skip page 1 title page if it has h1)
        if i > 0:
            page.insert_text(
                fitz.Point(36, 30),
                "FusionStudio Pro - User Manual",
                fontsize=8,
                color=(0.5, 0.5, 0.5)
            )
            # Add a thin rule under the header
            page.draw_line(
                fitz.Point(36, 35),
                fitz.Point(page.rect.width - 36, 35),
                color=(0.8, 0.8, 0.8),
                width=0.5
            )
            
        # Draw running footer on all pages
        page.draw_line(
            fitz.Point(36, page.rect.height - 35),
            fitz.Point(page.rect.width - 36, page.rect.height - 35),
            color=(0.8, 0.8, 0.8),
            width=0.5
        )
        page.insert_text(
            fitz.Point(36, page.rect.height - 22),
            "IDIADA ADAS & Driver Monitoring System Services",
            fontsize=8,
            color=(0.5, 0.5, 0.5)
        )
        page.insert_text(
            fitz.Point(page.rect.width - 80, page.rect.height - 22),
            f"Page {i + 1} of {num_pages}",
            fontsize=8,
            color=(0.5, 0.5, 0.5)
        )
        
    # Save the modified document directly to the final destination path
    doc.save(pdf_path)
    doc.close()
    
    # Force garbage collection to release file descriptors on Windows
    del doc
    import gc
    gc.collect()
    
    # Clean up the temp file
    if os.path.exists(temp_write_path):
        os.remove(temp_write_path)
        
    print(f"[SUCCESS] Final styled PDF generated at: {pdf_path}")

if __name__ == "__main__":
    main()
