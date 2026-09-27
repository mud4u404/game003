// Node 端读取知识库与默认配置（测试和命令行脚本用；浏览器端用 fetch）。
import { readFileSync } from 'node:fs';
const root = new URL('../../../data/', import.meta.url);
const read = name => JSON.parse(readFileSync(new URL(name, root), 'utf8'));
export function loadData() {
  const manifest = read('manifest.json');
  return { kb: { diseases: manifest.diseases.map(id => read(`diseases/${id}.json`)), exams: read('exams.json') }, config: read('hospital-default.json') };
}
