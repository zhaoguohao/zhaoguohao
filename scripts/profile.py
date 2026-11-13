"""Build repository-owned profile artwork from public GitHub data only."""
import argparse
import html
import json
import math
import os
from pathlib import Path
import re
from datetime import datetime, timezone, timedelta
from urllib.request import Request, urlopen
from urllib.parse import urlencode
import xml.etree.ElementTree as ET

ROOT = Path(__file__).resolve().parents[1]
TZ = timezone(timedelta(hours=8))


def text(x, y, value, size=16, color='#1d1d1f', weight=400, anchor='start'):
    return f'<text x="{x}" y="{y}" font-size="{size}" fill="{color}" font-weight="{weight}" text-anchor="{anchor}">{html.escape(str(value))}</text>'


def svg(height, body, bg='theme'):
    background = '<defs><linearGradient id="surface" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#edf3ff"/><stop offset=".55" stop-color="#eaf5fa"/><stop offset="1" stop-color="#def3ef"/></linearGradient></defs>' if bg == 'theme' else ''
    fill = 'url(#surface)' if bg == 'theme' else bg
    return f'<svg xmlns="http://www.w3.org/2000/svg" width="960" height="{height}" viewBox="0 0 960 {height}">{background}<rect width="960" height="{height}" fill="{fill}"/><g font-family="-apple-system, BlinkMacSystemFont, Segoe UI, Arial, PingFang SC, Microsoft YaHei, sans-serif">{body}</g></svg>'


def rect(x, y, w, h, color, radius=0):
    return f'<rect x="{x}" y="{y}" width="{w}" height="{h}" fill="{color}" rx="{radius}"/>'


def year_progress(now):
    start = datetime(now.year, 1, 1, tzinfo=now.tzinfo)
    end = datetime(now.year + 1, 1, 1, tzinfo=now.tzinfo)
    return (now - start).total_seconds() / (end - start).total_seconds()


def aggregate(repositories):
    stars, languages = 0, {}
    for repo in repositories:
        if repo['isPrivate'] or repo['isFork']:
            continue
        stars += repo['stargazerCount']
        for edge in repo['languages']['edges']:
            name = edge['node']['name']
            entry = languages.setdefault(name, {'name': name, 'bytes': 0, 'color': edge['node']['color'] or '#8b949e'})
            entry['bytes'] += edge['size']
    return {'stars': stars, 'languages': sorted(languages.values(), key=lambda x: (-x['bytes'], x['name']))}


def api(path, payload=None):
    token = os.environ.get('GH_TOKEN') or os.environ.get('GITHUB_TOKEN')
    if not token:
        raise RuntimeError('GH_TOKEN or GITHUB_TOKEN is required')
    req = Request('https://api.github.com/' + path, data=json.dumps(payload).encode() if payload else None,
                  headers={'Authorization': 'Bearer ' + token, 'Accept': 'application/vnd.github+json',
                           'Content-Type': 'application/json', 'User-Agent': 'aurora-profile', 'X-GitHub-Api-Version': '2022-11-28'})
    with urlopen(req, timeout=60) as response:
        data = json.load(response)
    if data.get('errors'):
        raise RuntimeError('GitHub GraphQL returned errors: ' + json.dumps(data['errors']))
    return data


def search_count(kind, query):
    data = api('search/' + kind + '?' + urlencode({'q': query, 'per_page': 1}))
    if data.get('incomplete_results') or not isinstance(data.get('total_count'), int):
        raise RuntimeError('Incomplete GitHub search results; previous artwork retained')
    return data['total_count']


def collect(owner, now):
    query = '''query($owner:String!,$after:String){user(login:$owner){repositories(first:100,after:$after,ownerAffiliations:OWNER,privacy:PUBLIC,isFork:false){pageInfo{hasNextPage endCursor} nodes{isPrivate isFork stargazerCount languages(first:100){pageInfo{hasNextPage} edges{size node{name color}}}}}}}'''
    repos, cursor = [], None
    while True:
        data = api('graphql', {'query': query, 'variables': {'owner': owner, 'after': cursor}})
        connection = data['data']['user']['repositories']
        for repo in connection['nodes']:
            if repo['languages']['pageInfo']['hasNextPage']:
                raise RuntimeError('Language pagination limit exceeded; refusing partial statistics')
        repos.extend(connection['nodes'])
        if not connection['pageInfo']['hasNextPage']:
            break
        next_cursor = connection['pageInfo']['endCursor']
        if not next_cursor or next_cursor == cursor:
            raise RuntimeError('Repository pagination stalled')
        cursor = next_cursor
    result = aggregate(repos)
    result.update(owner=owner, updated_at=now.isoformat(), year=now.year,
                  commits=search_count('commits', f'author:{owner} is:public author-date:{now.year}-01-01..{now.date()}'),
                  prs=search_count('issues', f'author:{owner} is:pr is:public'),
                  issues=search_count('issues', f'author:{owner} is:issue is:public'))
    return result


def hero(owner):
    b = rect(0, 0, 960, 64, '#eaf2fb')
    b += text(38, 39, owner + '.', 17, weight=700) + text(922, 39, 'A PERSONAL SPACE', 11, '#99999f', anchor='end')
    b += '<defs><linearGradient id="title"><stop stop-color="#5ba7ff"/><stop offset="1" stop-color="#7dded9"/></linearGradient><linearGradient id="silk" x1="0" y1=".6" x2="1" y2=".4"><stop stop-color="#0c1726"/><stop offset=".23" stop-color="#428ab0"/><stop offset=".45" stop-color="#d2f5f3"/><stop offset=".61" stop-color="#84bedc"/><stop offset=".82" stop-color="#47699c"/><stop offset="1" stop-color="#0b1420"/></linearGradient></defs>'
    b += text(480, 132, 'HELLO, WORLD.', 14, '#8c9bac', anchor='middle')
    b += text(480, 229, 'Always curious.', 76, '#ffffff', 700, 'middle')
    b += text(480, 311, 'Always building.', 76, 'url(#title)', 700, 'middle')
    b += text(480, 363, '从一个想法开始。', 17, '#8d9aaa', anchor='middle')
    b += text(480, 393, '让代码，成为下一种可能。', 17, '#8d9aaa', anchor='middle')
    for i in range(100):
        v = i / 99
        points = []
        for j in range(241):
            u = j / 240
            x = 70 + 820 * u
            y = 580 + 65 * (v - .5) + 105 * math.sin(2.2 * math.pi * u + .9 * v) * math.exp(-((u - .52) / .48) ** 2) + 38 * v * math.sin(math.pi * u)
            points.append(f'{x:.2f},{y:.2f}')
        b += f'<polyline points="{" ".join(points)}" fill="none" stroke="url(#silk)" stroke-width=".65" opacity="{.2 + .5 * math.sin(math.pi*v):.3f}"/>'
    b += text(40, 745, 'CODE · CREATE · EXPLORE', 11, '#9eb8ce') + text(920, 745, 'SKYSTAR STUDIO / EARTH', 11, '#728192', anchor='end')
    return svg(780, b, '#080c13')


def date_panel(now):
    progress = year_progress(now)
    b = text(52, 52, 'A WORK IN PROGRESS', 12, '#657487', 600)
    b += text(52, 104, '一点探索。', 36, weight=700) + text(52, 150, '每天，都算数。', 36, weight=700)
    for i, line in enumerate(['不必等到完美，才开始创造。', '这里记录想法、尝试，', '以及它们慢慢成为现实的过程。']):
        b += text(550, 80 + i*29, line, 16, '#657487')
    b += rect(34, 192, 427, 184, '#ffffff', 18) + rect(475, 192, 451, 184, '#ffffff', 18)
    b += text(64, 230, '最近更新', 14, '#657487') + text(64, 294, now.strftime('%m.%d'), 52, weight=600)
    b += text(235, 291, now.year, 22, '#657487') + text(64, 339, now.strftime('%H:%M') + ' · UTC+08:00', 14, '#657487')
    b += text(496, 230, '这一年的旅程', 14, '#657487') + text(496, 294, f'{progress*100:.1f}%', 52, weight=600)
    b += rect(496, 316, 394, 5, '#dfdfe5', 3) + rect(496, 316, round(394*progress, 2), 5, '#39a8c5', 3)
    b += text(496, 346, '还有新的可能，等待发生。', 13, '#657487')
    return svg(406, b)


def snake_heading():
    b = text(480, 45, 'THE LITTLE THINGS ADD UP', 12, '#657487', anchor='middle')
    b += text(480, 105, '让每一次提交，动起来。', 40, weight=700, anchor='middle')
    b += text(480, 146, '一年的足迹。一条永不停下的贪吃蛇。', 16, '#657487', anchor='middle')
    b = b.replace('#1d1d1f', '#eaf6ff').replace('#657487', '#9cb8cd')
    b = '<defs><radialGradient id="snake-glow" cx=".65" cy=".9" r=".9"><stop stop-color="#133c50"/><stop offset="1" stop-color="#0b1422"/></radialGradient></defs>' + rect(0, 0, 960, 400, 'url(#snake-glow)') + b
    return svg(174, b, '#0b1422')


def snake_panel():
    header = snake_heading().replace('height="174"', 'height="400"').replace('960 174', '960 400')
    snake = ET.fromstring((ROOT / 'assets/github-contribution-grid-snake.svg').read_text(encoding='utf-8'))
    # Recolor only CSS palette variables; preserve all paths and keyframes.
    palette = {'cb': '#224155', 'cs': '#edfaff', 'ce': '#182d40', 'c0': '#182d40', 'c1': '#1e5268', 'c2': '#23889b', 'c3': '#40c6ca', 'c4': '#97eee0'}
    for style in snake.iter('{http://www.w3.org/2000/svg}style'):
        for key, value in palette.items():
            style.text = re.sub(r'(--' + key + r':)[^;}]+', lambda match: match[1] + value, style.text or '')
    snake.set('x', '40')
    snake.set('y', '184')
    snake.set('width', '880')
    snake.set('height', '192')
    return header.replace('</svg>', ET.tostring(snake, encoding='unicode') + '</svg>')


def stats_panel(data):
    b = text(38, 54, '开源的点滴。', 30, weight=700) + text(922, 52, 'PUBLIC ACTIVITY', 12, '#657487', anchor='end')
    metrics = [(data['stars'], 'Stars earned'), (data['commits'], f'Commits · {data["year"]}'), (data['prs'], 'Pull requests'), (data['issues'], 'Issues')]
    for i, (value, label) in enumerate(metrics):
        x = 38 + i*230
        b += text(x, 130, f'{value:,}', 42, weight=600) + text(x, 164, label, 14, '#657487')
    b += rect(38, 198, 884, 1, '#eeeef2') + text(38, 233, 'Languages', 17, weight=600)
    langs = data['languages']
    total = sum(item['bytes'] for item in langs)
    shown = [dict(item) for item in langs[:5]]
    if len(langs) > 5:
        shown.append({'name': 'Other', 'bytes': sum(x['bytes'] for x in langs[5:]), 'color': '#b8c3d2'})
    x = 38
    if total:
        for item in shown:
            color = item['color'] if re.fullmatch(r'#[0-9a-fA-F]{6}', item['color']) else '#8b949e'
            width = 884 * item['bytes'] / total
            b += rect(round(x, 2), 255, round(width, 2), 8, color)
            x += width
        for i, item in enumerate(shown):
            x, y = 38 + (i % 3)*298, 301 + (i//3)*32
            b += text(x, y, f'{item["name"]}  {item["bytes"]/total:.1%}', 14, '#53535a')
    else:
        b += text(38, 301, 'No public source language data yet.', 15, '#657487')
    b += text(38, 378, 'Stars / languages: owned public non-fork repositories; languages weighted by code bytes.', 11, '#657487')
    b += text(38, 400, 'Commits: public default branches, calendar year. PRs / issues: public, all time.', 11, '#657487')
    b += text(38, 422, 'Stats updated: ' + data['updated_at'][:16].replace('T', ' ') + ' UTC+08:00', 11, '#657487')
    b += rect(38, 451, 884, 1, '#eeeef2') + text(38, 483, data['owner'], 11, '#9a9aa1') + text(922, 483, 'STAY CURIOUS.', 11, '#9a9aa1', anchor='end')
    return svg(510, b)


def render(data, now):
    return {'hero-aurora.svg': hero(data['owner']), 'date-aurora.svg': date_panel(now), 'contributions-aurora.svg': snake_panel(), 'stats-aurora.svg': stats_panel(data)}


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--owner', default='zhaoguohao')
    parser.add_argument('--data', type=Path, help='Render an existing public snapshot without API calls')
    args = parser.parse_args()
    now = datetime.now(TZ)
    data = json.loads(args.data.read_text(encoding='utf-8')) if args.data else collect(args.owner, now)
    output = render(data, now)
    for content in output.values():
        ET.fromstring(content)
    dest = ROOT / 'assets' / 'profile'
    dest.mkdir(parents=True, exist_ok=True)
    # Fetch and render everything before touching published assets. Actions only
    # commits on success; a failed refresh leaves the last good images online.
    for name, content in output.items():
        (dest / name).write_text(content, encoding='utf-8')
    (dest / 'public-stats.json').write_text(json.dumps(data, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    print(f'Updated {len(output)} SVGs from public data: stars={data["stars"]}, commits={data["commits"]}, PRs={data["prs"]}, issues={data["issues"]}')


if __name__ == '__main__':
    main()
