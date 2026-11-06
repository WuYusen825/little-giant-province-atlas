#!/usr/bin/env python3
"""从原始CSV重建省级/单列城市面板。仅使用标准库；不改写原始名单。"""
from pathlib import Path
from collections import Counter, defaultdict
import csv, json, re, unicodedata, hashlib, math

ROOT = Path(__file__).resolve().parents[2]
OUT = Path(__file__).resolve().parents[1]
TABLES = OUT / '统计表'
TABLES.mkdir(exist_ok=True)
YEARS = list(range(2019, 2026))
MERGE = {'深圳市':'广东省','宁波市':'浙江省','青岛市':'山东省','大连市':'辽宁省',
         '厦门市':'福建省','新疆生产建设兵团':'新疆维吾尔自治区'}
CITIES = ['深圳市','宁波市','青岛市','大连市','厦门市']
PROVINCES = ['北京市','天津市','河北省','山西省','内蒙古自治区','辽宁省','吉林省','黑龙江省',
 '上海市','江苏省','浙江省','安徽省','福建省','江西省','山东省','河南省','湖北省','湖南省',
 '广东省','广西壮族自治区','海南省','重庆市','四川省','贵州省','云南省','西藏自治区','陕西省',
 '甘肃省','青海省','宁夏回族自治区','新疆维吾尔自治区']
norm = lambda s: re.sub(r'\s+', '', unicodedata.normalize('NFKC',s))
short = lambda s: s.replace('维吾尔自治区','').replace('壮族自治区','').replace('回族自治区','').replace('自治区','').replace('省','').replace('市','')
def save(name, rows):
    with (TABLES / name).open('w',encoding='utf-8-sig',newline='') as f:
        w=csv.DictWriter(f,fieldnames=list(rows[0]));w.writeheader();w.writerows(rows)
def safe(a,b): return a/b if a is not None and b else None
def growth(a,b): return a/b-1 if b else None
rows=[]; manifest=[]
for p in sorted((ROOT/'整理名单'/'CSV').glob('*.csv')):
    data=list(csv.DictReader(p.open(encoding='utf-8-sig',newline='')))
    y=int(p.name[:4]);manifest.append({'文件':str(p.relative_to(ROOT)),'年份':y,'记录数':len(data),'SHA256':hashlib.sha256(p.read_bytes()).hexdigest()})
    for line,r in enumerate(data,2):
        province=MERGE.get(r['城市'].strip(),r['城市'].strip())
        assert province in PROVINCES, province
        rows.append({'年份':y,'原申报地区':r['城市'].strip(),'省级地区':province,'企业名':r['企业名'].strip(),
          '标准化企业名':norm(r['企业名']),'源文件':p.name,'CSV行号':line})
groups=defaultdict(list)
for r in rows: groups[r['标准化企业名']].append(r)
for group in groups.values():
    first=min(group,key=lambda r:(r['年份'],r['CSV行号']))
    for r in group:
        r['首次出现年份']=first['年份'];r['历年首次出现']=int(r is first)
        r['重复出现组记录数']=len(group)
        r['所属单列城市']=r['原申报地区'] if r['原申报地区'] in CITIES else ''
        r['首次归属申报地区']=first['原申报地区']
        r['首次归属省级地区']=first['省级地区']
        r['省内城市信息']='可确认' if r['所属单列城市'] or r['省级地区'] in ['北京市','天津市','上海市','重庆市'] else '未提供'
raw=Counter(r['年份'] for r in rows)
firstcounts=Counter(r['年份'] for r in rows if r['历年首次出现'])
province_counts=Counter((r['省级地区'],r['年份']) for r in rows)
prov_first=Counter((r['首次归属省级地区'],r['年份']) for r in rows if r['历年首次出现'])
original_counts=Counter((r['原申报地区'],r['年份']) for r in rows)
city_first=Counter((r['首次归属申报地区'],r['年份']) for r in rows if r['历年首次出现'])
assert len(rows)==sum(raw.values())
assert sum(firstcounts.values())==len(groups)
assert all(len({r['年份'] for r in g})==len(g) for g in groups.values()), '同年存在重复，需要进一步处理'

panel=[]
for p in PROVINCES:
    cum=0
    for y in YEARS:
        n=province_counts[p,y];f=prov_first[p,y];cum+=f;prev=province_counts[p,y-1] if y>2019 else None
        ordered=sorted([province_counts[q,y] for q in PROVINCES],reverse=True)
        rank=1+sum(v>n for v in ordered)
        panel.append({'省级地区':p,'年份':y,'当年名单数':n,'当年首次出现数_按名称':f,'跨年再次出现数':n-f,
         '同比净增减':n-prev if prev is not None else None,'当年数量同比增长率':growth(n,prev),
         '增长率状态':'首年无基期' if y==2019 else ('上年为零_不可计算' if prev==0 else '可计算'),
         '累计去重企业数_按名称':cum,'累计增长率':growth(cum,cum-f) if y>2019 else None,
         '当年全国份额':n/raw[y],'省级数量排名_并列':rank,
         '全国份额变化_百分点':100*(n/raw[y]-prev/raw[y-1]) if y>2019 else None,
         '相对全国增速倍数':safe(safe(n,prev),safe(raw[y],raw[y-1])) if y>2019 else None})
lookup={(r['省级地区'],r['年份']):r for r in panel}
national=[]
for y in YEARS:
    ns=sorted([province_counts[p,y] for p in PROVINCES],reverse=True)
    shares=[n/raw[y] for n in ns]
    national.append({'年份':y,'当年名单数':raw[y],'数量同比增长率':growth(raw[y],raw.get(y-1)),
     '当年首次出现数_按名称':firstcounts[y],'跨年再次出现数':raw[y]-firstcounts[y],
     '累计去重企业数_按名称':sum(firstcounts[t] for t in YEARS if t<=y),
     '原申报地区覆盖数':len({r['原申报地区'] for r in rows if r['年份']==y}),
     '有记录省份数':sum(n>0 for n in ns),'CR5_前五省份额':sum(shares[:5]),'CR10_前十省份额':sum(shares[:10]),
     'HHI_0至10000':sum(s*s for s in shares)*10000,
     '长三角三省一市份额':sum(province_counts[p,y] for p in ['上海市','江苏省','浙江省','安徽省'])/raw[y],
     '京津冀份额':sum(province_counts[p,y] for p in ['北京市','天津市','河北省'])/raw[y]})
summary=[]
earlytotal=sum(raw[y] for y in [2020,2021,2022]);latetotal=sum(raw[y] for y in [2023,2024,2025])
for p in PROVINCES:
    a=sum(province_counts[p,y] for y in [2020,2021,2022]);b=sum(province_counts[p,y] for y in [2023,2024,2025])
    firsttotal=sum(prov_first[p,y] for y in YEARS)
    total=sum(province_counts[p,y] for y in YEARS)
    summary.append({'省级地区':p,'历年名单记录总数':total,'历年去重企业数_按名称':firsttotal,
     '去重企业全国占比':firsttotal/len(groups),'2019名单数':province_counts[p,2019],'2025名单数':province_counts[p,2025],
     '2025同比增长率':lookup[p,2025]['当年数量同比增长率'],
     '2024至2025净增减':province_counts[p,2025]-province_counts[p,2024],
     '2019至2025名单数CAGR':(province_counts[p,2025]/province_counts[p,2019])**(1/6)-1 if province_counts[p,2019] else None,
     '2020至2022名单合计':a,'2023至2025名单合计':b,'近三年对前三年数量增长率':growth(b,a),
     '2020至2022全国份额':a/earlytotal,'2023至2025全国份额':b/latetotal,
     '两窗口全国份额变化_百分点':100*(b/latetotal-a/earlytotal),
     '全国扩批预期数_描述性':a/earlytotal*latetotal,
     '超出等份额预期数_描述性':b-a/earlytotal*latetotal,
     '2022数量排名':lookup[p,2022]['省级数量排名_并列'],'2025数量排名':lookup[p,2025]['省级数量排名_并列'],
     '2022至2025排名上升位数':lookup[p,2022]['省级数量排名_并列']-lookup[p,2025]['省级数量排名_并列']})
summary.sort(key=lambda r:r['历年去重企业数_按名称'],reverse=True)
citypanel=[]
for city in CITIES:
    cum=0
    for y in YEARS:
        p=MERGE[city];n=original_counts[city,y];f=city_first[city,y];cum+=f
        missing=city=='宁波市' and y==2024
        unavailable_compare=missing or (city=='宁波市' and y==2025)
        citypanel.append({'单列城市':city,'所属省级地区':p,'年份':y,'当年名单数':None if missing else n,
         '数据状态':'缺少独立标签_不能识别' if missing else '源CSV单列记录',
         '同比净增减':n-original_counts[city,y-1] if y>2019 and not unavailable_compare else None,
         '当年数量同比增长率':growth(n,original_counts[city,y-1]) if y>2019 and not unavailable_compare else None,
         '当年首次出现数_按名称':None if missing else f,
         '累计去重企业数_按名称_首次归属':None if city=='宁波市' and y>=2024 else cum,
         '占所属省当年名单份额':None if missing else safe(n,province_counts[p,y]),
         '当年全国份额':None if missing else n/raw[y],
         '单列城市内部排名_并列':None if y==2024 else 1+sum(original_counts[c,y]>n for c in CITIES)})
citysummary=[]
for c in CITIES:
    a=sum(original_counts[c,y] for y in [2020,2021,2022]);b=sum(original_counts[c,y] for y in [2023,2024,2025])
    citysummary.append({'单列城市':c,'所属省级地区':MERGE[c],'历年名单记录总数':sum(original_counts[c,y] for y in YEARS),
     '2025名单数':original_counts[c,2025],'2025同比增长率':growth(original_counts[c,2025],original_counts[c,2024]),
     '2025占本省份额':safe(original_counts[c,2025],province_counts[MERGE[c],2025]),
     '2020至2022名单合计':a,'2023至2025名单合计':None if c=='宁波市' else b,
     '近三年对前三年数量增长率':None if c=='宁波市' else growth(b,a),
     '两窗口全国份额变化_百分点':None if c=='宁波市' else 100*(b/latetotal-a/earlytotal),
     '说明':'2024年未单列，不能作完整七年总量或三年窗口比较；历年合计仅为已单列记录' if c=='宁波市' else '五城比较不等于全国城市排名'})
originalpanel=[{'原申报地区':p,'合并省级地区':MERGE.get(p,p),'年份':y,'当年名单数':original_counts[p,y]} for p in sorted({r['原申报地区'] for r in rows}) for y in YEARS]
duplicate_rows=[r for r in rows if r['重复出现组记录数']>1]
growth_contribution=[]
nationaldelta=raw[2025]-raw[2024]
for p in PROVINCES:
    delta=province_counts[p,2025]-province_counts[p,2024]
    growth_contribution.append({'省级地区':p,'2024名单数':province_counts[p,2024],'2025名单数':province_counts[p,2025],
      '同比净增减':delta,'占全国净增减比重':safe(delta,nationaldelta)})
growth_contribution.sort(key=lambda r:r['同比净增减'],reverse=True)
mapping=[{'原申报地区':p,'合并省级地区':MERGE.get(p,p),'合并说明':'单列城市并入所属省' if p in CITIES else ('兵团按地域并入新疆' if p=='新疆生产建设兵团' else '原样保留')} for p in sorted({r['原申报地区'] for r in rows})]
save('01_省级逐年数量增长与份额.csv',panel)
save('02_省级年度数量矩阵.csv',[dict(省级地区=p,**{str(y):province_counts[p,y] for y in YEARS}) for p in PROVINCES])
save('03_省级累计去重数量矩阵.csv',[dict(省级地区=p,**{str(y):lookup[p,y]['累计去重企业数_按名称'] for y in YEARS}) for p in PROVINCES])
save('04_省级综合比较.csv',summary)
save('05_全国年度趋势与集中度.csv',national)
save('06_五个单列城市逐年分析.csv',citypanel)
save('07_五个单列城市综合比较.csv',citysummary)
save('08_2025增长贡献分解.csv',growth_contribution)
save('09_原37申报地区逐年数量.csv',originalpanel)
save('10_申报地区省级映射.csv',mapping)
save('11_重复企业逐条审计.csv',duplicate_rows)
save('12_企业逐条分析底表.csv',rows)
save('13_输入文件校验清单.csv',manifest)
quality=[{'年份':y,'未见记录原申报地区':'、'.join(sorted(set(original_counts.keys()) and {p for p in sorted({r['原申报地区'] for r in rows}) if not original_counts[p,y]})),
 '未见记录省级地区':'、'.join(p for p in PROVINCES if not province_counts[p,y]),
 '说明':'省级零值仅为源CSV未见记录，不证明官方数量为零。'+('宁波2024独立标签缺失，单列城市数置空。' if y==2024 else '')} for y in YEARS]
save('14_年度覆盖与数据限制.csv',quality)

# 图表数据保留原始数值；以中文字段CSV作为完整可复核的统计表。
chart_prov=[{'province':r['省级地区'],'name':short(r['省级地区']),'year':str(r['年份']),
 'count':r['当年名单数'],'firstCount':r['当年首次出现数_按名称'],'cumulative':r['累计去重企业数_按名称'],
 'growthRate':r['当年数量同比增长率'],'share':r['当年全国份额'],'rank':r['省级数量排名_并列'],
 'shareChange':r['全国份额变化_百分点']} for r in panel]
chart_nat=[{'year':str(r['年份']),'count':r['当年名单数'],'firstCount':r['当年首次出现数_按名称'],
 'cumulative':r['累计去重企业数_按名称'],'growthRate':r['数量同比增长率'],
 'cr5Share':r['CR5_前五省份额'],'cr10Share':r['CR10_前十省份额'],'hhi':r['HHI_0至10000'],
 'deltaShare':r['长三角三省一市份额'],'capitalShare':r['京津冀份额']} for r in national]
chart_sum=[{'province':r['省级地区'],'name':short(r['省级地区']),'total':r['历年去重企业数_按名称'],
 'totalShare':r['去重企业全国占比'],'count2025':r['2025名单数'],'growthRate':r['2025同比增长率'],
 'delta':r['2024至2025净增减'],'early':r['2020至2022名单合计'],'late':r['2023至2025名单合计'],
 'earlyShare':r['2020至2022全国份额'],'lateShare':r['2023至2025全国份额'],
 'shareChange':r['两窗口全国份额变化_百分点'],'relativeExcess':r['超出等份额预期数_描述性'],
 'rankChange':r['2022至2025排名上升位数']} for r in summary]
chart_cities=[{'city':r['单列城市'],'name':short(r['单列城市']),'province':r['所属省级地区'],'year':str(r['年份']),
 'count':r['当年名单数'],'growthRate':r['当年数量同比增长率'],'provinceShare':r['占所属省当年名单份额'],
 'nationalShare':r['当年全国份额'],'cumulative':r['累计去重企业数_按名称_首次归属'],
 'dataStatus':r['数据状态']} for r in citypanel]
defs=[{'label':'当年名单数','definition':'按文件名年份分组的名单记录数；同年无标准化同名重复。未见记录的地区记0，含义仅为源CSV未见记录。'},
 {'label':'累计去重企业数','definition':'企业名经Unicode NFKC、去空白后，跨年首次出现归属计数；无统一社会信用代码，不合并更名、不保证法人实体唯一。不代表仍有效认定存量。'},
 {'label':'数量同比增长率','definition':'当年名单数/上年名单数-1；首年或上年0时为空。增长受全国批次规模影响。'},
 {'label':'全国份额','definition':'本地区当年名单数/全国源CSV当年总记录数。'},
 {'label':'近三年份额变化','definition':'2023—2025年本省名单合计/该窗口全国合计，减去2020—2022年同口径份额；两个等长完整三年窗口，乘100后单位为百分点。'},
 {'label':'省级合并','definition':'五个计划单列城市按所属省合并；兵团按地域并入新疆。城市分析为省级数据的子集，不可再与省级数据相加。'}]
source={'label':'用户提供的2019—2025年七批名单CSV','files':[m['文件'] for m in manifest],
 'evidenceFlow':[{'title':'输入数据','detail':f"{m['文件']}；{m['记录数']}条；SHA256 {m['SHA256']}"} for m in manifest],
 'metricDefinitions':defs,'caveats':['名单内统计，不独立证明每批官方名单完整。','不包含退出、复核失败、注销、迁址信息，累计数不是当前有效认定存量。','2024年宁波独立标签缺失，城市数据置空，不能解释为0。','缺少GDP、人口、工业企业数、研发及行业字段，不能据此识别经济规模校正后的密度或因果关系。']}
queries={}
for k,rs in [('province_year',chart_prov),('national_year',chart_nat),('province_summary',chart_sum),('city_year',chart_cities)]:
    queries[k]={'rows':rs,'source':source,'methods':[{'language':'Python','code':'运行 脚本/统计分析.py；按行读取CSV，以文件名前四位为年份；依据10_申报地区省级映射.csv合并；所有比率保留未四舍五入分子分母。'}]}
meta={'rawCount':len(rows),'uniqueNameCount':len(groups),'duplicateGroups':len([v for v in groups.values() if len(v)>1]),
 'withinYearDuplicateCount':0,'provinceCount':31,'originalRegionCount':37,'nationalDelta2025':nationaldelta,
 'provinceAnnualRows':len(panel),'cityAnnualRows':len(citypanel)}
snap={'surface':'report','title':'小巨人企业的省级分布与增长（2019—2025）',
 'generatedAt':__import__('datetime').datetime.now(__import__('datetime').timezone(__import__('datetime').timedelta(hours=8))).isoformat(),'status':'reviewed','buildStatus':'creating',
 'exportPreferences':{'selected':None,'destinations':[]},'filters':[],'queries':queries,'analysis':meta}
(OUT/'分析数据.json').write_text(json.dumps(snap,ensure_ascii=False,indent=2),encoding='utf-8')
# 独立复核：所有年、省、累计、单列城市父级关系以及份额总和。
checks=[]
for y in YEARS:
    assert sum(r['当年名单数'] for r in panel if r['年份']==y)==raw[y]
    assert abs(sum(r['当年全国份额'] for r in panel if r['年份']==y)-1)<1e-12
    assert sum(lookup[p,y]['累计去重企业数_按名称'] for p in PROVINCES)==len({r['标准化企业名'] for r in rows if r['年份']<=y})
    for c in CITIES: assert original_counts[c,y]<=province_counts[MERGE[c],y]
    checks.append({'年份':y,'省级合计等于原始行数':True,'份额合计等于1':True,'累计合计等于独立去重结果':True})
assert sum(r['同比净增减'] for r in growth_contribution)==nationaldelta
(OUT/'复核记录.json').write_text(json.dumps({'meta':meta,'checks':checks,'inputManifest':manifest},ensure_ascii=False,indent=2),encoding='utf-8')
print(json.dumps({'meta':meta,'national':national,'top5':summary[:5],'cities':citysummary,
 'shareGainers':sorted(summary,key=lambda r:r['两窗口全国份额变化_百分点'],reverse=True)[:5]},ensure_ascii=False,indent=2))
