import { execFileSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';

const serial = process.env.ANDROID_SERIAL || 'emulator-5554';
const adb = (...args) => execFileSync('adb', ['-s', serial, ...args], { encoding: 'utf8' });
const [action, value] = process.argv.slice(2);
if (action === 'screenshot') {
  writeFileSync(value, execFileSync('adb', ['-s', serial, 'exec-out', 'screencap', '-p']));
} else if (action === 'open') {
  console.log(adb('shell', 'am', 'start', '-W', '-a', 'android.intent.action.VIEW', '-d', `pressurejournal:///${value ?? ''}`, 'com.pressurejournal.app'));
} else {
  adb('shell', 'uiautomator', 'dump', '/sdcard/pressure-ui.xml');
  const xml = adb('shell', 'cat', '/sdcard/pressure-ui.xml');
  const nodes = [...xml.matchAll(/<node\b[^>]*>/g)].map(match => Object.fromEntries([...match[0].matchAll(/([\w-]+)="([^"]*)"/g)].map(attribute => [attribute[1], attribute[2]])));
  if (action === 'dump') console.log(nodes.filter(node => node.text || node['content-desc']).map(node => ({ text: node.text, label: node['content-desc'], id: node['resource-id'], bounds: node.bounds })));
  else {
    const node = nodes.find(node => node['resource-id'] === value) ?? nodes.find(node => node['content-desc'] === value) ?? nodes.find(node => node.text === value);
    if (!node) throw new Error(`Element not found: ${value}`);
    const coordinates = node.bounds.match(/\d+/g).map(Number);
    adb('shell', 'input', 'tap', String(Math.round((coordinates[0] + coordinates[2]) / 2)), String(Math.round((coordinates[1] + coordinates[3]) / 2)));
    if (action === 'type') adb('shell', 'input', 'text', process.argv[4].replaceAll(' ', '%s'));
  }
}
