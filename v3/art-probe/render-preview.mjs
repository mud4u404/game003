// Renders the same vector scene used by the interactive HTML into a reviewable SVG.
// Inkscape can export this to PNG without requiring a browser in CI.
import { readFile, writeFile } from 'node:fs/promises';
import { runInNewContext } from 'node:vm';
const world={innerHTML:'',addEventListener(){}};
const dummy={setAttribute(){},addEventListener(){},style:{},textContent:'',dataset:{}};
const document={getElementById:id=>id==='world'?world:dummy};
runInNewContext(await readFile(new URL('./scene.js',import.meta.url),'utf8'),{document,performance:{now:()=>0},requestAnimationFrame(){}});
const scene=world.innerHTML;
const xml=`<svg xmlns="http://www.w3.org/2000/svg" width="390" height="844" viewBox="0 0 390 844">
<defs><linearGradient id="topbar" x2="0" y2="1"><stop stop-color="#203947"/><stop offset="1" stop-color="#294653" stop-opacity="0"/></linearGradient></defs>
<style>text{font-family:'Noto Sans CJK SC','Microsoft YaHei',sans-serif}.room-label text{fill:#fff;font-size:10px;font-weight:600;letter-spacing:.5px}</style>
<rect width="390" height="844" fill="#e8e8e2"/><g>${scene}</g>
<rect width="390" height="86" fill="url(#topbar)"/><text x="23" y="28" fill="#b9d2d5" font-size="10" letter-spacing="2">美术管线验证 · 可运行场景</text><text x="22" y="58" fill="#fff" font-size="24" font-weight="650" letter-spacing="2">仁和医院</text>
<rect x="307" y="28" width="66" height="28" rx="9" fill="#18333b" fill-opacity=".8" stroke="#ffffff" stroke-opacity=".25"/><circle cx="319" cy="42" r="3" fill="#7de0a9"/><text x="329" y="47" fill="#fff" font-size="14">09:24</text>
<rect x="16" y="95" width="94" height="26" rx="13" fill="#173947" fill-opacity=".87"/><circle cx="30" cy="108" r="3" fill="#7de0a9"/><text x="39" y="112" fill="#fff" font-size="11">门诊运行中</text>
<text x="195" y="600" text-anchor="middle" fill="#44606b" font-size="11">点击人物查看当前环节</text>
<path d="M0 643q0-23 23-23h344q23 0 23 23v201H0Z" fill="#f9faf8"/><rect x="178" y="628" width="34" height="4" rx="2" fill="#c4d0d0"/>
<text x="20" y="662" fill="#72888c" font-size="11">正在关注的患者</text><text x="20" y="688" fill="#243641" font-size="20" font-weight="700">陈女士</text><text x="90" y="688" fill="#88999c" font-size="12">· 42 岁</text>
<rect x="312" y="662" width="59" height="26" rx="13" fill="#e4f0ed"/><text x="322" y="680" fill="#287365" font-size="11" font-weight="700">候诊中</text>
<rect x="20" y="708" width="44" height="23" rx="8" fill="#e8f1ee"/><text x="29" y="724" fill="#35796f" font-size="11">到院</text><path d="M65 720h35" stroke="#cad5d5"/>
<rect x="100" y="708" width="44" height="23" rx="8" fill="#397f7e"/><text x="109" y="724" fill="#fff" font-size="11">候诊</text><path d="M145 720h35" stroke="#cad5d5"/>
<text x="184" y="724" fill="#a4b3b7" font-size="11">问诊</text><path d="M220 720h35" stroke="#cad5d5"/><text x="260" y="724" fill="#a4b3b7" font-size="11">检查</text>
<text x="20" y="753" fill="#576b71" font-size="11">她正在候诊区等待叫号。医生空出诊室后，</text><text x="20" y="770" fill="#576b71" font-size="11">她会自己走进去。</text>
<rect x="20" y="788" width="171" height="38" rx="9" fill="#2b7274"/><text x="76" y="812" fill="#fff" font-size="12" font-weight="700">跟随患者</text>
<rect x="201" y="788" width="169" height="38" rx="9" fill="#fff" stroke="#b9c9c9"/><text x="272" y="812" fill="#315960" font-size="12" font-weight="700">暂停</text>
</svg>`;
await writeFile(new URL('./preview.svg',import.meta.url),xml);
console.log('Wrote v3/art-probe/preview.svg');
