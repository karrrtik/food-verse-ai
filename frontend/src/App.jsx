import { useEffect, useMemo, useState } from 'react'
import { Activity, Apple, ArrowRight, AudioLines, ChefHat, CircleHelp, Clock3, Flame, Heart, Leaf, Menu, Search, ShieldCheck, Sparkles, Upload, Utensils, Video, X } from 'lucide-react'
import { foods, recipes } from './data'

const API = (import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8000').replace(/\/$/, '')
const nav = [
  {id:'overview', label:'Overview', icon:Activity},
  {id:'scanner', label:'Food scanner', icon:Apple},
  {id:'freshness', label:'Freshness lab', icon:Leaf},
  {id:'kitchen', label:'Kitchen vision', icon:Video},
  {id:'chef', label:'AI chef', icon:ChefHat},
  {id:'planner', label:'Meal planner', icon:Heart},
]
function Button({children, onClick, kind='primary', disabled=false}) {
  return <button disabled={disabled} onClick={onClick} className={`btn ${kind==='primary'?'btn-primary':kind==='light'?'btn-light':'btn-ghost'}`}>{children}</button>
}
function Card({children, className=''}) { return <section className={`card ${className}`}>{children}</section> }
function SectionTitle({eyebrow,title,desc}) { return <div className="section-title"><div><p className="eyebrow">{eyebrow}</p><h2>{title}</h2>{desc&&<p className="muted">{desc}</p>}</div></div> }
function App() {
  const [page,setPage]=useState('overview')
  const [mobileNav,setMobileNav]=useState(false)
  const [apiStatus,setApiStatus]=useState('checking')
  const [search,setSearch]=useState('')
  const [foodFile,setFoodFile]=useState(null)
  const [foodPreview,setFoodPreview]=useState('')
  const [recognition,setRecognition]=useState(null)
  const [recognizing,setRecognizing]=useState(false)
  const [freshFile,setFreshFile]=useState(null)
  const [freshPreview,setFreshPreview]=useState('')
  const [freshResult,setFreshResult]=useState(null)
  const [videoFile,setVideoFile]=useState(null)
  const [videoResult,setVideoResult]=useState(null)
  const [busy,setBusy]=useState(false)
  const [ingredientQuery,setIngredientQuery]=useState('')
  const [diet,setDiet]=useState('Vegetarian')
  const [goal,setGoal]=useState('Balanced')
  const [mealResult,setMealResult]=useState(null)
  const [notice,setNotice]=useState('')
  useEffect(()=>{fetch(`${API}/api/health`).then(r=>r.ok?r.json():Promise.reject()).then(()=>setApiStatus('online')).catch(()=>setApiStatus('offline'))},[])
  const filteredFoods=foods.filter(f=>f.name.toLowerCase().includes(search.toLowerCase()))
  const filteredRecipes=useMemo(()=>recipes.filter(r=>(r.name+' '+r.ingredients.join(' ')).toLowerCase().includes(ingredientQuery.toLowerCase())),[ingredientQuery])
  function chooseImage(file,setFile,setPreview,setResult) {
    if(!file) return
    setFile(file); setPreview(URL.createObjectURL(file)); setResult(null); setNotice('')
  }
  async function recognizeFood() {
    if(!foodFile){setNotice('Choose a food photo first.');return}
    setRecognizing(true);setNotice('')
    const fd=new FormData();fd.append('file',foodFile)
    try { const r=await fetch(`${API}/api/food/recognize`,{method:'POST',body:fd});const data=await r.json();if(!r.ok)throw new Error(data.detail||'Recognition failed');setRecognition(data) }
    catch(e){setRecognition({error:e.message})} finally {setRecognizing(false)}
  }
  async function assessFreshness() {
    if(!freshFile){setNotice('Choose a food photo first.');return}
    setBusy(true);setNotice('')
    const fd=new FormData();fd.append('file',freshFile)
    try {const r=await fetch(`${API}/api/freshness/assess`,{method:'POST',body:fd});const d=await r.json();if(!r.ok)throw new Error(d.detail||'Analysis failed');setFreshResult(d)}
    catch(e){setFreshResult({error:e.message})}finally{setBusy(false)}
  }
  async function reviewVideo() {
    if(!videoFile){setNotice('Choose a kitchen video first.');return}
    setBusy(true);setNotice('')
    const fd=new FormData();fd.append('file',videoFile)
    try {const r=await fetch(`${API}/api/kitchen/review`,{method:'POST',body:fd});const d=await r.json();if(!r.ok)throw new Error(d.detail||'Video review failed');setVideoResult(d)}
    catch(e){setVideoResult({error:e.message})}finally{setBusy(false)}
  }
  async function generatePlan(e) {
    e.preventDefault();setBusy(true)
    try {const r=await fetch(`${API}/api/meal-plan`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({diet,goal})});const d=await r.json();setMealResult(d)}
    catch {setMealResult({error:'Could not reach backend. Start FastAPI and try again.'})}finally{setBusy(false)}
  }
  const title=nav.find(n=>n.id===page)?.label||'Overview'
  function pageContent() {
    if(page==='overview') return <Overview setPage={setPage} apiStatus={apiStatus} />
    if(page==='scanner') return <><SectionTitle eyebrow="COMPUTER VISION" title="Food scanner" desc="Upload a food photo and run the local image-classification model."/><div className="two-col"><Card><UploadPanel title="Upload food photo" subtitle="JPG, PNG or WEBP · max 10 MB" preview={foodPreview} file={foodFile} onFile={f=>chooseImage(f,setFoodFile,setFoodPreview,setRecognition)} accept="image/*"/><Button onClick={recognizeFood} disabled={recognizing}>{recognizing?'Analyzing locally…':<><Sparkles size={16}/> Recognize food</>}</Button><p className="tiny">First run may download model weights to the backend machine. No hosted AI inference API is used.</p></Card><Card><p className="eyebrow">ANALYSIS RESULT</p>{recognition?.error?<ErrorText text={recognition.error}/>:recognition?<><div className="result-hero"><div className="result-icon">🍽️</div><div><h3>{recognition.prediction}</h3><p className="muted">Top model prediction</p></div></div><div className="nutrition-grid">{(recognition.nutrition||{}).calories!==undefined&&<Metric label="Calories" value={`${recognition.nutrition.calories} kcal`}/>}<Metric label="Model confidence" value={`${Math.round((recognition.confidence||0)*100)}%`}/></div><p className="tiny">Nutrition is a generic per-serving estimate matched by label; image recognition cannot reliably determine portion size or recipe.</p></>:<EmptyState icon={Apple} title="Your results will appear here" text="Add a clear photo of a single dish to get started."/>}</Card></div></>
    if(page==='freshness') return <><SectionTitle eyebrow="VISUAL REVIEW" title="Freshness lab" desc="Get a cautious visual heuristic from an uploaded fruit or vegetable photo."/><div className="two-col"><Card><UploadPanel title="Upload produce photo" subtitle="Use a well-lit close-up" preview={freshPreview} file={freshFile} onFile={f=>chooseImage(f,setFreshFile,setFreshPreview,setFreshResult)} accept="image/*"/><Button onClick={assessFreshness} disabled={busy}>{busy?'Reviewing…':<><Leaf size={16}/> Assess appearance</>}</Button></Card><Card><p className="eyebrow">VISUAL ASSESSMENT</p>{freshResult?.error?<ErrorText text={freshResult.error}/>:freshResult?<><div className="result-hero"><div className="result-icon">🌿</div><div><h3>{freshResult.label}</h3><p className="muted">Heuristic, not a safety test</p></div></div><p>{freshResult.explanation}</p><div className="notice"><ShieldCheck size={18}/><span>{freshResult.warning}</span></div></>:<EmptyState icon={Leaf} title="Check visible appearance" text="This screen reports visual signals only, not microbial safety."/ >}</Card></div></>
    if(page==='kitchen') return <><SectionTitle eyebrow="VIDEO REVIEW" title="Kitchen vision" desc="Upload a short clip to sample frames for a human hygiene review."/><div className="two-col"><Card><label className="upload-box"><input type="file" accept="video/*" onChange={e=>{setVideoFile(e.target.files?.[0]||null);setVideoResult(null)}}/><div className="upload-symbol"><Video/></div><strong>{videoFile?.name||'Choose a kitchen video'}</strong><span>MP4, MOV or WEBM · short clips recommended</span></label>{videoFile&&<p className="muted tiny">{(videoFile.size/1024/1024).toFixed(1)} MB selected</p>}<Button onClick={reviewVideo} disabled={busy}>{busy?'Sampling frames…':<><Video size={16}/> Review video</>}</Button></Card><Card><p className="eyebrow">FRAME REVIEW</p>{videoResult?.error?<ErrorText text={videoResult.error}/>:videoResult?<><h3>{videoResult.frames_sampled} frames sampled</h3><p>{videoResult.message}</p><div className="notice"><ShieldCheck size={18}/><span>{videoResult.limitation}</span></div></>:<EmptyState icon={Video} title="Review kitchen footage" text="The current prototype samples frames; it does not certify hygiene compliance."/ >}</Card></div></>
    if(page==='chef') return <><SectionTitle eyebrow="COOK WITH WHAT YOU HAVE" title="Smart cooking assistant" desc="Search the bundled recipe collection by dish or ingredient."/><Card><div className="search-field"><Search size={18}/><input value={ingredientQuery} onChange={e=>setIngredientQuery(e.target.value)} placeholder="Try paneer, oats, rice…"/></div><div className="recipe-grid">{filteredRecipes.map(r=><RecipeCard key={r.name} recipe={r}/>)}</div>{!filteredRecipes.length&&<p className="muted">No bundled recipe matched. Try another ingredient.</p>}</Card></>
    if(page==='planner') return <><SectionTitle eyebrow="YOUR ROUTINE, YOUR CHOICES" title="Personalized meal planner" desc="Generate a simple plan from bundled food data. This is not medical nutrition advice."/><div className="two-col"><Card><form className="form-stack" onSubmit={generatePlan}><label>Diet preference<select value={diet} onChange={e=>setDiet(e.target.value)}><option>Vegetarian</option><option>Non-vegetarian</option><option>Vegan</option></select></label><label>Goal<select value={goal} onChange={e=>setGoal(e.target.value)}><option>Balanced</option><option>Higher protein</option><option>Light meals</option></select></label><Button disabled={busy}>{busy?'Building plan…':'Generate meal plan'} <ArrowRight size={16}/></Button></form></Card><Card>{mealResult?.error?<ErrorText text={mealResult.error}/>:mealResult?<><p className="eyebrow">SUGGESTED DAY</p><div className="plan-list">{mealResult.meals.map(m=><div className="plan-row" key={m.meal}><span className="plan-dot">•</span><div><small>{m.meal}</small><strong>{m.food}</strong><span className="muted tiny">{m.calories} kcal estimate</span></div></div>)}</div><div className="notice"><Heart size={18}/><span>Adjust portions to your needs. For medical conditions or therapeutic diets, consult a qualified professional.</span></div></>:<EmptyState icon={Heart} title="Your plan appears here" text="Choose your preferences and generate a sample day."/ >}</Card></div></>
    return <><SectionTitle eyebrow="FOOD INTELLIGENCE, MADE SIMPLE" title={title}/><p>Choose a module from the sidebar.</p></>
  }
  return <div className="app-shell">
    {mobileNav&&<button className="mobile-scrim" onClick={()=>setMobileNav(false)} aria-label="Close navigation"/>}
    <aside className={`sidebar ${mobileNav?'sidebar-open':''}`}><div className="brand"><div className="brand-mark"><Leaf size={22}/></div><div><strong>food verse<span> ai</span></strong><small>FOOD INTELLIGENCE</small></div><button className="close-nav" onClick={()=>setMobileNav(false)}><X/></button></div><div className="workspace-label">WORKSPACE</div><nav>{nav.map(n=>{const Icon=n.icon;return <button key={n.id} className={`nav-item ${page===n.id?'active':''}`} onClick={()=>{setPage(n.id);setMobileNav(false);setNotice('')}}><Icon size={18}/><span>{n.label}</span>{n.id==='scanner'&&<span className="nav-tag">AI</span>}</button>})}</nav><div className="sidebar-bottom"><div className="local-card"><div className="local-icon"><ShieldCheck size={18}/></div><div><strong>Privacy first</strong><p>Local inference, no AI API key</p></div></div><div className="api-status"><span className={`status-dot ${apiStatus}`}/><span>Backend {apiStatus==='checking'?'checking…':apiStatus==='online'?'connected':'offline'}</span></div><p className="sidebar-foot">FOOD VERSE AI · PROTOTYPE</p></div></aside>
    <main className="main-area"><header className="topbar"><button className="mobile-menu" onClick={()=>setMobileNav(true)}><Menu/></button><div className="crumb">Workspace <span>/</span> <strong>{title}</strong></div><div className="top-actions"><div className="date-pill"><span className="live-dot"/> Local AI workspace</div><button className="help-btn" title="About this prototype" onClick={()=>setNotice('Educational prototype: nutrition is estimated; freshness and hygiene outputs are not safety certifications.')}><CircleHelp size={19}/></button></div></header><div className="page-wrap">{notice&&<div className="notice page-notice"><CircleHelp size={18}/><span>{notice}</span><button onClick={()=>setNotice('')}><X size={16}/></button></div>}{pageContent()}<footer>Made for better food decisions <span>•</span> Estimates only, always use your judgement.</footer></div></main>
  </div>
}
function Overview({setPage,apiStatus}) {
 return <><div className="hero"><div className="hero-copy"><div className="hero-kicker"><Sparkles size={14}/> YOUR PERSONAL FOOD COMPANION</div><h1>Eat smarter.<br/><em>Live better.</em></h1><p>Discover what’s on your plate, explore recipes, and build a routine that feels good — all in one place.</p><Button onClick={()=>setPage('scanner')}>Scan your food <ArrowRight size={16}/></Button><div className="hero-meta"><span><ShieldCheck size={15}/> No external AI API</span><span><span className={`status-dot ${apiStatus}`}/> {apiStatus==='online'?'Backend connected':'Local prototype'}</span></div></div><div className="hero-art"><div className="orb orb-one"/><div className="orb orb-two"/><div className="food-bowl">🥗</div><div className="floating-card float-top"><span className="float-icon">🌱</span><div><strong>Fresh choices</strong><small>Start with what you have</small></div></div><div className="floating-card float-bottom"><Flame size={18}/><div><strong>Nutrition insights</strong><small>Estimates, made simple</small></div></div></div></div>
 <div className="welcome-row"><div><p className="eyebrow">YOUR FOOD TOOLKIT</p><h2>What would you like to do?</h2></div><span className="muted tiny">6 modules · one workspace</span></div>
 <div className="feature-grid">{[{id:'scanner',icon:Apple,color:'lime',title:'Food scanner',desc:'Identify food with a local vision model.',action:'Analyze a photo'},{id:'freshness',icon:Leaf,color:'mint',title:'Freshness lab',desc:'Review visible appearance signals.',action:'Check produce'},{id:'kitchen',icon:Video,color:'peach',title:'Kitchen vision',desc:'Sample kitchen video for human review.',action:'Review footage'},{id:'chef',icon:ChefHat,color:'lavender',title:'Smart AI chef',desc:'Find recipes from ingredients you have.',action:'Explore recipes'},{id:'planner',icon:Heart,color:'pink',title:'Meal planner',desc:'Build a simple plan around your goals.',action:'Plan my meals'},{id:'chef',icon:Utensils,color:'sand',title:'Recipe library',desc:'Explore easy, bundled cooking ideas.',action:'Browse recipes'}].map(f=>{const Icon=f.icon;return <button key={f.title} className="feature-card" onClick={()=>setPage(f.id)}><div className={`feature-icon ${f.color}`}><Icon size={21}/></div><h3>{f.title}</h3><p>{f.desc}</p><span>{f.action}<ArrowRight size={15}/></span></button>})}</div>
 <div className="bottom-grid"><Card><div className="card-heading"><div><p className="eyebrow">QUICK LOOK</p><h3>Popular foods</h3></div><span className="mini-badge">Sample data</span></div><div className="food-list">{foods.slice(0,4).map(f=><div className="food-row" key={f.name}><span className="food-emoji">{f.emoji}</span><div className="food-name"><strong>{f.name}</strong><small>{f.group}</small></div><span className="food-kcal">{f.calories} <small>kcal</small></span></div>)}</div></Card><Card className="tip-card"><div className="tip-icon"><Sparkles size={20}/></div><p className="eyebrow">A LITTLE REMINDER</p><h3>Healthy eating is a pattern, not a perfect plate.</h3><p className="muted">Use these tools to learn, experiment, and make choices that work for you.</p><button onClick={()=>setPage('planner')}>Build a meal plan <ArrowRight size={15}/></button></Card></div></>
}
function UploadPanel({title,subtitle,preview,file,onFile,accept}) {
 return <label className="upload-box"><input type="file" accept={accept} onChange={e=>onFile(e.target.files?.[0]||null)}/>{preview?<img className="image-preview" src={preview} alt="Selected upload preview"/>:<div className="upload-symbol"><Upload size={23}/></div>}<strong>{file?.name||title}</strong><span>{file?`${(file.size/1024/1024).toFixed(1)} MB selected`:subtitle}</span><small>Click to browse files</small></label>
}
function Metric({label,value}) {return <div className="metric"><span>{label}</span><strong>{value}</strong></div>}
function EmptyState({icon:Icon,title,text}) {return <div className="empty-state"><div><Icon size={24}/></div><h3>{title}</h3><p>{text}</p></div>}
function ErrorText({text}) {return <div className="error-text"><strong>Could not complete the request</strong><p>{text}</p><p className="tiny">Check that the backend is running and try again.</p></div>}
function RecipeCard({recipe}) {return <article className="recipe-card"><div className="recipe-art">{recipe.name.toLowerCase().includes('paneer')?'🧀':recipe.name.toLowerCase().includes('banana')?'🥣':recipe.name.toLowerCase().includes('dal')?'🍛':'🍲'}<span><Clock3 size={13}/>{recipe.time}</span></div><div className="recipe-body"><h3>{recipe.name}</h3><div className="tag-row">{recipe.tags.map(t=><span key={t}>{t}</span>)}</div><strong className="ingredient-label">Ingredients</strong><p>{recipe.ingredients.join(' · ')}</p><details><summary>Cooking steps</summary><ol>{recipe.steps.map(s=><li key={s}>{s}</li>)}</ol></details></div></article>}
export default App
