import { parseWorkbook } from "./import-report.js";
self.onmessage = ({ data }) => {
  try {
    const report = parseWorkbook(data.buffer, data.fileName, (progress) =>
      self.postMessage({ progress }),
    );
    self.postMessage({ report });
  } catch (error) {
    self.postMessage({ error: error.message || "Не удалось прочитать файл." });
  }
};
