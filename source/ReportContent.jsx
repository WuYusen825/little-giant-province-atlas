import React, { useState } from 'react';
import { EvidenceChart, DataComponent, ReportSection, RichNarrative, useDataApp, SortableItem, SortableRegion } from '../../data-app-public.jsx';
import geo from '../assets/china-map.json';
import './province.css';
const num=n=>n==null?'—':Number(n).toLocaleString('zh-CN',{maximumFractionDigits:0});
const pct=n=>n==null?'—':`${(n*100).toFixed(1)}%`;
const signed=n=>n==null?'—':`${n>0?'+':''}${n.toFixed(2)}`;
const years=['2019','2020','2021','2022','2023','2024','2025'];
const cities=['深圳市','宁波市','青岛市','大连市','厦门市'];
const order=['geography','national','province-detail','momentum','concentration','special-cities','methods'];
function Text({id,children}){return <RichNarrative id={id} value={children} label="编辑分析文字"/>;}
function Table({rows,columns}){return <div className="p-table-scroll" data-reviewed-rows><table className="p-table"><thead><tr>{columns.map(c=><th key={c.key}>{c.label}</th>)}</tr></thead><tbody>{rows.map((r,i)=><tr key={i}>{columns.map(c=><td key={c.key}>{c.format?c.format(r[c.key]):r[c.key]??'—'}</td>)}</tr>)}</tbody></table></div>;}
function Download({rows,name}){return <button className="p-download" onClick={()=>{if(!rows.length)return;const ks=Object.keys(rows[0]);const q=x=>'"'+String(x??'').replaceAll('"','""')+'"';const csv='\uFEFF'+[ks.map(q).join(','),...rows.map(r=>ks.map(k=>q(r[k])).join(','))].join('\r\n');const u=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8;'}));const a=document.createElement('a');a.href=u;a.download=name+'.csv';a.click();URL.revokeObjectURL(u);}}>下载此表 CSV</button>;}
function ChinaMap({rows,year,metric}){
 const [hover,setHover]=useState(null);const by=new Map(rows.map(r=>[r.province,r]));
 const label={count:'当年名单数',cumulative:'累计去重名称数',growthRate:'名单数同比'}[metric];
 const mx=Math.max(1,...rows.map(r=>Math.abs(r[metric]??0)));const maxCount=Math.max(1,...rows.map(r=>r[metric]??0));
 const color=r=>{if(!r||r[metric]==null)return 'var(--muted)';const v=r[metric];if(metric==='growthRate'){const t=Math.min(Math.abs(v)/mx,1);return v>=0?`hsl(213 65% ${88-t*55}%)`:`hsl(29 80% ${88-t*46}%)`;}if(v===0)return 'var(--muted)';const t=Math.log1p(v)/Math.log1p(maxCount);return `hsl(211 67% ${95-t*61}%)`;};
 const h=hover&&by.get(hover);return <div className="p-map" data-reviewed-rows>
 <svg viewBox="0 0 880 900" role="group" aria-label={`${year}年省级${label}地图`}>{geo.map((f,i)=><path key={f.name||i} d={f.path} fill={color(by.get(f.name))} stroke="var(--border)" strokeWidth="0.7" tabIndex={f.name?0:undefined} role={f.name?'img':undefined} aria-label={`${f.name||'南海诸岛'} ${year}年 ${label} ${by.has(f.name)?(metric==='growthRate'?pct(by.get(f.name)?.[metric]):num(by.get(f.name)?.[metric])):'无数据'}`} onMouseEnter={()=>setHover(f.name)} onMouseLeave={()=>setHover(null)} onFocus={()=>setHover(f.name)} onBlur={()=>setHover(null)}/>)}{geo.filter(f=>by.has(f.name)&&f.label).map(f=><text key={f.name} x={f.label[0]} y={f.label[1]} className="p-map-label" textAnchor="middle">{by.get(f.name).name}</text>)}</svg>
 {hover&&<div className="p-map-hover" role="status" aria-live="polite">{hover?<><strong>{hover} · {year}</strong><br/>{label}：{by.has(hover)?(metric==='growthRate'?pct(h?.[metric]):num(h?.[metric])):'无样本数据'}{h&&<><br/>当年全国份额 {pct(h.share)}</>}</>:<>悬停省份查看数值<br/>键盘 Tab 可逐省查看</>}</div>}
 <div className="p-map-legend">{metric==='growthRate'?<><span className="p-gradient-div"/> 负增长 → 正增长；灰色为不可计算</>:<><span className="p-gradient"/> 少 → 多（对数色阶）；灰色为未见记录或无数据</>}</div></div>;
}
const annualCols=[{key:'year',label:'年份'},{key:'count',label:'名单数',format:num},{key:'growthRate',label:'数量同比',format:pct},{key:'share',label:'全国份额',format:pct},{key:'rank',label:'数量名次',format:num},{key:'cumulative',label:'累计去重名称数',format:num}];
export function ReportContent(){
 const {snapshot,appTitle}=useDataApp();const P=snapshot.queries.province_year.rows,N=snapshot.queries.national_year.rows,S=snapshot.queries.province_summary.rows,C=snapshot.queries.city_year.rows;
 const [year,setYear]=useState('2025'),[metric,setMetric]=useState('count'),[province,setProvince]=useState('江苏省'),[city,setCity]=useState('深圳市');
 const selected=P.filter(r=>r.year===year),ranked=[...selected].sort((a,b)=>(b[metric]??-Infinity)-(a[metric]??-Infinity));
 const detail=P.filter(r=>r.province===province),cityDetail=C.filter(r=>r.city===city),gainers=[...S].sort((a,b)=>b.shareChange-a.shareChange),contribute=[...S].sort((a,b)=>b.delta-a.delta);
 const scopes={count:'当年名单数',cumulative:'累计去重企业名称数',growthRate:'当年名单数同比'};
 return <article className="report-content province-report">
 <header className="report-hero"><h1>{appTitle}</h1><Text id="p-intro">以省级分布为主，补充深圳等五个单列城市。每一年对应一批名单，统计结果反映提供的 CSV 样本。</Text><p className="p-artifact-links"><a href="report.pdf" target="_blank" rel="noopener">下载 PDF 报告</a><a href="https://github.com/WuYusen825/little-giant-province-atlas/tree/main/data" target="_blank" rel="noopener">查看汇总数据</a></p></header>
 <ReportSection id="p-summary" title="主要发现" queryId="province_summary" queryIds={['province_summary','national_year','city_year']} sourceRowsByQuery={{province_summary:S,national_year:N,city_year:C}} showHeading={false}>
 <Text id="p-summary-text">{`## 主要发现\n\n- 2025 年名单有 **3,482** 条，较 2024 年增长 **15.6%**。江苏 **807** 条、广东 **691** 条、浙江 **398** 条，位列省级前三。\n- 历年按企业名称去重后共 **19,333** 个名称，江苏、广东、浙江合计 **8,050** 个，占 **41.6%**。这不是当前仍有效认定的企业存量。\n- 从源名单看，前五省份额由 2021 年的 **40.0%** 升至 2025 年的 **68.6%**。近三年相对前三年，江苏、广东的全国份额分别增加 **15.05** 和 **9.28** 个百分点。\n- 深圳 2025 年有 **347** 条，占广东的 **50.2%**。2024 年宁波未单列，不能把其单列记录缺失解释为数量归零。`}</Text></ReportSection>
 <SortableRegion id="province-report-sections" label="分析章节" variant="stack" authoredOrder={order}>
 <SortableItem id="geography" label="地图与年度排名" kind="custom"><section className="p-section">
 <Text id="p-map-title">## 各省每一年有多少家，增长率如何</Text>
 <div className="p-controls"><label>年份 <select value={year} onChange={e=>setYear(e.target.value)}>{years.map(y=><option key={y}>{y}</option>)}</select></label><label>地图指标 <select value={metric} onChange={e=>setMetric(e.target.value)}><option value="count">当年名单数</option><option value="cumulative">累计去重名称数</option><option value="growthRate">当年数量同比增长率</option></select></label><span>仅影响本节地图、排名和数据表</span></div>
 <DataComponent id="province-map" queryId="province_year" kind="custom" title={`${year}年省级${scopes[metric]}`} displayRows={selected} sourceRows={selected}><ChinaMap rows={selected} year={year} metric={metric}/></DataComponent>
 <Text id="p-map-caption">地图按省级行政区合并，五个单列城市已包含在所属省内。未见记录的省份，零值只表示源 CSV 中无该省记录。台湾、香港、澳门不在所给名单范围内，不计为零。地图边界采用阿里云 DataV 公开 GeoJSON，使用墨卡托投影。</Text>
 <EvidenceChart id="province-ranking" queryId="province_year" title={`${year}年省级${scopes[metric]}前十（样本内）`} rows={ranked.filter(r=>r[metric]!=null).slice(0,10)} sourceRows={selected} height={380} spec={{type:'horizontalBar',x:'name',y:metric,valueDecimals:metric==='growthRate'?3:0}}/>
 <DataComponent id="province-table" queryId="province_year" kind="table" title={`${year}年31个省级地区明细`} displayRows={ranked} sourceRows={selected}><Table rows={ranked} columns={[{key:'province',label:'省级地区'},...annualCols.slice(1)]}/><Download rows={ranked} name={`${year}省级明细`}/></DataComponent>
 </section></SortableItem>
 <SortableItem id="national" label="全国趋势" kind="chart"><section className="p-section">
 <Text id="p-national-title">## 全国名单规模的变化，是解读地方增速的基准</Text>
 <EvidenceChart id="national-count" queryId="national_year" title="2019—2025年全国当年名单数" rows={N} sourceRows={N} height={320} spec={{type:'bar',x:'year',y:'count',xLabel:'年份',yLabel:'名单数（条）',colors:{count:'#246caa'},valueDecimals:0}}/>
 <DataComponent id="national-table" queryId="national_year" kind="table" title="逐年规模和数量同比" displayRows={N} sourceRows={N}><Table rows={N} columns={[{key:'year',label:'年份'},{key:'count',label:'当年名单数',format:num},{key:'growthRate',label:'数量同比',format:pct},{key:'firstCount',label:'当年首次出现',format:num},{key:'cumulative',label:'累计去重名称',format:num}]}/></DataComponent>
 <Text id="p-national-note">2019 年为本组数据的首批，基数仅 248 条，因此不把 2019—2025 的高复合增速作为主要比较依据。2023、2024 年全国样本名单规模分别下降 15.7%、18.0%，地方数量下降应结合全国份额判断。</Text>
 </section></SortableItem>
 <SortableItem id="province-detail" label="省份详情" kind="chart"><section className="p-section">
 <Text id="p-detail-title">## 查看任一省份的完整七年轨迹</Text>
 <div className="p-controls"><label>省份 <select value={province} onChange={e=>setProvince(e.target.value)}>{[...new Set(P.map(r=>r.province))].map(p=><option key={p}>{p}</option>)}</select></label><span>仅影响本节；全国趋势不变</span></div>
 <div className="p-two"><EvidenceChart id="province-trend" queryId="province_year" title={`${province}逐年名单数`} rows={detail} sourceRows={detail} height={300} spec={{type:'line',x:'year',y:'count',xLabel:'年份',yLabel:'名单数（条）',colors:{count:'#246caa'},valueDecimals:0}}/><EvidenceChart id="province-share-trend" queryId="province_year" title={`${province}逐年全国份额`} rows={detail} sourceRows={detail} height={300} spec={{type:'line',x:'year',y:'share',xLabel:'年份',yLabel:'全国份额',colors:{share:'#246caa'},valueDecimals:3}}/></div>
 <DataComponent id="province-detail-table" queryId="province_year" kind="table" title={`${province}数量、同比、份额与排名`} displayRows={detail} sourceRows={detail}><Table rows={detail} columns={annualCols}/><Download rows={detail} name={province+'七年面板'}/></DataComponent>
 </section></SortableItem>
 <SortableItem id="momentum" label="份额和增长贡献" kind="chart"><section className="p-section">
 <Text id="p-momentum-title">## 数量增长之外，哪些省份取得了更大份额</Text>
 <Text id="p-momentum-text">比较 2020—2022 年与 2023—2025 年两个完整三年窗口，分别把本省名单合计除以全国名单合计。江苏由 7.71% 升至 22.75%，广东由 9.51% 升至 18.79%。浙江数量增加约 11.6%，份额却由 11.73% 微降至 11.63%，说明数量增长和相对份额提升并非同一件事。这一比较反映样本名单分布变化，不用于推断政策或经济因果。</Text>
 <EvidenceChart id="share-shifts" queryId="province_summary" title="近三年相对前三年全国份额变化（百分点）" rows={gainers.map(r=>({...r,points:r.shareChange}))} sourceRows={S} height={740} spec={{type:'horizontalBar',x:'name',y:'points',xLabel:'省级地区',yLabel:'份额变化（百分点）',colors:Object.fromEntries(gainers.map(r=>[r.name,r.shareChange>=0?'#246caa':'#c47d2e'])),valueDecimals:2}}/>
 <Text id="p-contribution-text">2025 年全国名单比上年净增 470 条。其中广东增加 130 条、江苏增加 96 条、山东增加 78 条，三省合计增加 304 条，约占全国净增的 64.7%。这是数量变化的算术分解。</Text>
 <EvidenceChart id="growth-contribution" queryId="province_summary" title="各省对2025年名单数量净变化的贡献（条）" rows={contribute} sourceRows={S} height={740} spec={{type:'horizontalBar',x:'name',y:'delta',xLabel:'省级地区',yLabel:'同比净增减（条）',colors:Object.fromEntries(contribute.map(r=>[r.name,r.delta>=0?'#246caa':'#c47d2e'])),valueDecimals:0}}/>
 <DataComponent id="province-comparison-table" queryId="province_summary" kind="table" title="省级长期规模、份额变化和排名变动" displayRows={S} sourceRows={S}><Table rows={S} columns={[{key:'province',label:'省级地区'},{key:'total',label:'历年去重名称',format:num},{key:'count2025',label:'2025名单数',format:num},{key:'growthRate',label:'2025同比',format:pct},{key:'shareChange',label:'三年窗口份额变化（百分点）',format:signed},{key:'rankChange',label:'2022→2025排名上升位数',format:num}]}/><Download rows={S} name="省级综合比较"/></DataComponent>
 </section></SortableItem>
 <SortableItem id="concentration" label="集中度与区域组合" kind="chart"><section className="p-section">
 <Text id="p-concentration-title">## 样本中的省际集中程度提高</Text>
 <EvidenceChart id="concentration-trend" queryId="national_year" title="每年前五省、前十省占全国名单的份额" rows={N} sourceRows={N} height={330} spec={{type:'line',x:'year',y:'cr5Share',xLabel:'年份',yLabel:'全国份额',colors:{cr5Share:'#246caa',cr10Share:'#c47d2e'},fields:['cr5Share','cr10Share'],legend:{labels:{cr5Share:'前五省份额',cr10Share:'前十省份额'}},stackable:false,valueDecimals:3}}/>
 <EvidenceChart id="region-clusters" queryId="national_year" title="长三角三省一市、京津冀占全国名单的份额" rows={N} sourceRows={N} height={330} spec={{type:'line',x:'year',y:'deltaShare',xLabel:'年份',yLabel:'全国份额',colors:{deltaShare:'#246caa',capitalShare:'#c47d2e'},fields:['deltaShare','capitalShare'],legend:{labels:{deltaShare:'长三角（沪苏浙皖）',capitalShare:'京津冀'}},stackable:false,valueDecimals:3}}/>
 <Text id="p-concentration-note">2025 年前五省份额为 68.6%，前十省为 86.5%；长三角三省一市占 45.2%。CR5、CR10 每年按当年的排名选取，成员可以变化。集中度只描述所给名单，来源覆盖和整理口径的变化也可能影响结果；统计表另提供 HHI（省级份额平方和 × 10,000）。</Text>
 </section></SortableItem>
 <SortableItem id="special-cities" label="单列城市" kind="chart"><section className="p-section">
 <Text id="p-cities-title">## 深圳等五个单列城市在各自省内占多少</Text>
 <Text id="p-cities-intro">这些城市仍包含在省级合计内。这里只比较源 CSV 独立列出的深圳、宁波、青岛、大连、厦门，不能据此作全国城市排名。</Text>
 <EvidenceChart id="city-latest-count" queryId="city_year" title="2025年五个单列城市的名单数" rows={C.filter(r=>r.year==='2025').sort((a,b)=>b.count-a.count)} sourceRows={C.filter(r=>r.year==='2025')} height={300} spec={{type:'horizontalBar',x:'name',y:'count',xLabel:'地区',yLabel:'名单数（条）',colors:{count:'#246caa'},valueDecimals:0}}/>
 <DataComponent id="city-latest-table" queryId="city_year" kind="table" title="2025年单列城市数量与本省占比" displayRows={C.filter(r=>r.year==='2025')} sourceRows={C.filter(r=>r.year==='2025')}><Table rows={C.filter(r=>r.year==='2025')} columns={[{key:'city',label:'城市'},{key:'province',label:'所属省'},{key:'count',label:'2025名单数',format:num},{key:'growthRate',label:'数量同比',format:pct},{key:'provinceShare',label:'占本省份额',format:pct}]}/></DataComponent>
 <div className="p-controls"><label>城市 <select value={city} onChange={e=>setCity(e.target.value)}>{cities.map(c=><option key={c}>{c}</option>)}</select></label><span>仅影响下方城市轨迹与表格</span></div>
 <EvidenceChart id="city-trend" queryId="city_year" title={`${city}逐年名单数`} rows={cityDetail} sourceRows={cityDetail} height={300} spec={{type:'line',x:'year',y:'count',xLabel:'年份',yLabel:'名单数（条）',colors:{count:'#246caa'},valueDecimals:0,connectNulls:false}}/>
 <DataComponent id="city-year-table" queryId="city_year" kind="table" title={`${city}逐年明细`} displayRows={cityDetail} sourceRows={cityDetail}><Table rows={cityDetail} columns={[{key:'year',label:'年份'},{key:'count',label:'名单数',format:num},{key:'growthRate',label:'数量同比',format:pct},{key:'provinceShare',label:'占本省份额',format:pct},{key:'dataStatus',label:'数据状态'}]}/><Download rows={cityDetail} name={city+'七年单列面板'}/></DataComponent>
 <Text id="p-city-limit">**宁波的特殊处理：**2024 年缺少独立“宁波市”标签，浙江省标签下出现了含“宁波”的企业名，但不能只凭名称完整恢复所在地。因此宁波 2024 数量、2024 和 2025 同比以及跨越该年的累计数留空，不作完整七年或三年窗口比较。其他城市的数量也以原始申报标签为准。</Text>
 </section></SortableItem>
 <SortableItem id="methods" label="口径与复现" kind="narrative"><ReportSection id="methods-body" title="统计口径与后续研究" queryId="province_year" showHeading={false}>
 <Text id="p-methods">{`## 统计口径与后续研究\n\n**范围与合并。**2019—2025 年七个 CSV 共 19,442 行。原“城市”列是 37 个申报地区，按行政地域合并为 31 个省级单位。深圳归广东、宁波归浙江、青岛归山东、大连归辽宁、厦门归福建，兵团按地域归新疆。\n\n**去重与累计。**同年没有标准化同名重复；跨年有 109 组同名重复，共 218 行。年度数保留跨年重复，累计数按 Unicode NFKC 和去空白后的名称首次出现计数。缺少统一社会信用代码，不能排除更名、OCR差异或同名不同法人。累计数不扣除退出、复核失败、注销或迁址，不是当前有效认定存量。\n\n**增长与份额。**当年数量 ÷ 上年数量 − 1。首年、上年为零或单列城市不可识别时留空，界面显示“—”。三年窗口采用2020—2022与2023—2025，以分子合计除以分母合计，不平均年度百分比。名次采用并列排名，1、1、3。低基数高增速需连同数量阅读。\n\n**证据边界。**省级未见记录记0只描述源文件，不独立确认官方数量为零或每批名单完整。集聚、份额、排名和增长贡献属于描述性关联。GDP、人口、工业企业数、研发支出和产业结构不在源数据中，不能据此计算人均密度、经济密度或因果效应。后续加入这些省年指标后，可研究每万家工业企业的小巨人数量、每万人数量，以及研发与入选数量的关联。\n\n**复现。**分析目录保存14张 UTF-8 BOM CSV、输入文件SHA256、企业逐行来源与重复审计、Python标准库脚本。省年表217行，单列城市年表35行。省级年度合计、份额合计、累计去重合计及2025增长贡献已与原记录核对。地图边界来自[阿里云DataV](https://datav.aliyun.com/portal/school/atlas/area_selector)，只用于统计展示。`}</Text>
 </ReportSection></SortableItem>
 </SortableRegion></article>;
}
