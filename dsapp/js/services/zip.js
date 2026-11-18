import JSZip from 'jszip';

export async function importZipToFS(file, fs) {
  const zip = await JSZip.loadAsync(file);
  let imported = 0;
  const entries = Object.values(zip.files).filter((e) => !e.dir);
  for (const entry of entries) {
    const path = entry.name;
    const u8 = await entry.async('uint8array');
    const binary = u8.some((b) => b === 0);
    await fs.write(path, binary ? u8 : new TextDecoder().decode(u8), { binary });
    imported++;
  }
  return imported;
}

export async function exportFSToZip(fs) {
  const zip = new JSZip();
  const tree = await fs.tree();
  for (const item of tree) {
    if (item.binary) {
      const u8 = await fs.readBinary(item.path);
      zip.file(item.path, u8);
    } else {
      const text = await fs.read(item.path);
      zip.file(item.path, text);
    }
  }
  return zip.generateAsync({ type: 'blob' });
}

export function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}
