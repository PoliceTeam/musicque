"""Giữ bộ animation game và đóng gói lại GLB sau khi xuất từ Blender."""
import json
import struct
import sys
from pathlib import Path

path = Path(sys.argv[1])
data = path.read_bytes()
assert data[:4] == b'glTF'
json_size = struct.unpack_from('<I', data, 12)[0]
model = json.loads(data[20:20 + json_size])
binary = data[28 + json_size:]
names = {'CardHold', 'CardWait', 'CardPlay', 'CardPickup'}
clips = {}
for clip in model.get('animations', []):
    if clip['name'] in names and clip['name'] not in clips:
        clips[clip['name']] = clip
assert clips.keys() == names, f'Thiếu animation: {names - clips.keys()}'
model['animations'] = list(clips.values())

accessors = set()
for mesh in model['meshes']:
    for primitive in mesh['primitives']:
        accessors.update(primitive['attributes'].values())
        if 'indices' in primitive:
            accessors.add(primitive['indices'])
        for target in primitive.get('targets', []):
            accessors.update(target.values())
for skin in model.get('skins', []):
    if 'inverseBindMatrices' in skin:
        accessors.add(skin['inverseBindMatrices'])
for clip in model['animations']:
    for sampler in clip['samplers']:
        accessors.update((sampler['input'], sampler['output']))
accessor_map = {old: new for new, old in enumerate(sorted(accessors))}
model['accessors'] = [model['accessors'][old] for old in sorted(accessors)]
for mesh in model['meshes']:
    for primitive in mesh['primitives']:
        primitive['attributes'] = {name: accessor_map[index] for name, index in primitive['attributes'].items()}
        if 'indices' in primitive:
            primitive['indices'] = accessor_map[primitive['indices']]
        for target in primitive.get('targets', []):
            for name, index in target.items():
                target[name] = accessor_map[index]
for skin in model.get('skins', []):
    if 'inverseBindMatrices' in skin:
        skin['inverseBindMatrices'] = accessor_map[skin['inverseBindMatrices']]
for clip in model['animations']:
    for sampler in clip['samplers']:
        for name in ('input', 'output'):
            sampler[name] = accessor_map[sampler[name]]

views = {accessor['bufferView'] for accessor in model['accessors']}
views.update(image['bufferView'] for image in model.get('images', []))
assert all('sparse' not in accessor for accessor in model['accessors'])
view_map = {old: new for new, old in enumerate(sorted(views))}
packed = bytearray()
packed_views = []
for old in sorted(views):
    view = model['bufferViews'][old].copy()
    offset = view.get('byteOffset', 0)
    packed.extend(b'\0' * (-len(packed) % 4))
    view['byteOffset'] = len(packed)
    packed.extend(binary[offset:offset + view['byteLength']])
    packed_views.append(view)
for accessor in model['accessors']:
    accessor['bufferView'] = view_map[accessor['bufferView']]
for image in model.get('images', []):
    image['bufferView'] = view_map[image['bufferView']]
model['bufferViews'] = packed_views
model['buffers'] = [{'byteLength': len(packed)}]
payload = json.dumps(model, separators=(',', ':')).encode()
payload += b' ' * (-len(payload) % 4)
packed.extend(b'\0' * (-len(packed) % 4))
result = struct.pack('<4sII', b'glTF', 2, 28 + len(payload) + len(packed))
result += struct.pack('<I4s', len(payload), b'JSON') + payload
result += struct.pack('<I4s', len(packed), b'BIN\0') + packed
assert len(result) == struct.unpack_from('<I', result, 8)[0]
assert len(result) < 1_500_000, f'Asset vượt ngân sách: {len(result)} byte'
path.write_bytes(result)
print(json.dumps({'bytes': len(result), 'clips': list(clips), 'primitives': sum(len(mesh['primitives']) for mesh in model['meshes'])}))
