var e={estimate:[{subject:`Your estimate for {job}`,body:`Hi {first_name},

Just checking that the estimate for {job} reached you. Happy to answer any questions or adjust anything.

{signoff}`},{subject:`Re: Your estimate for {job}`,body:`Hi {first_name},

Following up on the estimate for {job}. If the timing or scope needs to change, just reply and let me know what would work better.

{signoff}`},{subject:`Should I close out your estimate?`,body:`Hi {first_name},

I haven't heard back about {job}, so I'll close out the estimate for now. If you'd still like to go ahead, just reply and we'll pick it right back up.

{signoff}`}],invoice:[{subject:`Invoice for {job}`,body:`Hi {first_name},

A friendly reminder that the invoice for {job}{amount_phrase} is still open. If it's already on its way, thank you, and please ignore this.

{signoff}`},{subject:`Re: Invoice for {job}`,body:`Hi {first_name},

Following up on the invoice for {job}{amount_phrase}. If something about it doesn't look right, just reply and we'll sort it out.

{signoff}`},{subject:`Open invoice for {job}`,body:`Hi {first_name},

The invoice for {job}{amount_phrase} is still showing as open on our end. Could you reply with an update on when to expect payment?

{signoff}`}],inquiry:[{subject:`Following up on your request`,body:`Hi {first_name},

Thanks again for reaching out about {job}. Do you have a minute to reply with a good time to talk, or any details that would help us put together a price?

{signoff}`},{subject:`Re: Following up on your request`,body:`Hi {first_name},

Just checking in on {job}. If you've already found someone, no problem at all. If not, we'd be glad to help.

{signoff}`},{subject:`Still need help with {job}?`,body:`Hi {first_name},

I'll stop checking in after this one. If you still need help with {job}, just reply and we'll get back to you.

{signoff}`}]},t=[3,7,14],n={estimate:{yes:`Yes, let's go ahead`,ask:`I have a question`,pay:`Pay the deposit`},invoice:{yes:``,ask:`I have a question`,pay:`Pay the invoice`},inquiry:{yes:`Yes, let's set up a time`,ask:`I have a question`,pay:``}};function r(e){let t=String(e||``).trim().split(/\s+/)[0]||``;return!t||t.length>30||/[@\d<>]/.test(t)?`there`:t.charAt(0).toUpperCase()+t.slice(1)}function i(e,t,n){let i=t.amount?String(t.amount):``,a={first_name:r(t.name),job:t.job||(t.kind===`invoice`?`your recent job`:(t.kind,`your project`)),business:n.business||``,signoff:n.signoff||n.business||``,amount:i,amount_phrase:i?` (${i})`:``};return String(e).replace(/\{(first_name|job|business|signoff|amount_phrase|amount)\}/g,(e,t)=>a[t])}var a=document.querySelector(`[data-fud-form]`),o=document.querySelector(`[data-fud-out]`),s=document.querySelector(`[data-fud-list]`),c=document.querySelector(`[data-fud-reply]`),l=864e5,u=a?.querySelector(`input[name="sent"]`);u&&(u.value=new Date().toISOString().slice(0,10));function d(e){let t=new Date(e);for(;t.getUTCDay()===0||t.getUTCDay()===6;)t=new Date(t.getTime()+l);return t}var f=e=>e.toLocaleDateString(`en-US`,{weekday:`short`,month:`short`,day:`numeric`,timeZone:`UTC`}),p=(e,t,n)=>{let r=document.createElement(e);return t&&(r.className=t),n!==void 0&&(r.textContent=n),r};function m(c=!1){if(!a||!s||!o)return;let u=new FormData(a),m=String(u.get(`kind`))in e?String(u.get(`kind`)):`estimate`,h=String(u.get(`biz`)||``).slice(0,60),g={kind:m,name:String(u.get(`name`)||``).slice(0,60),job:String(u.get(`job`)||``).slice(0,80),amount:m===`invoice`?String(u.get(`amount`)||``).slice(0,20):``},_={business:h,signoff:h},v=String(u.get(`sent`)||``),y=/^\d{4}-\d{2}-\d{2}$/.test(v)?Date.parse(`${v}T12:00:00Z`):Date.now(),b=n[m];s.replaceChildren(),e[m].forEach((e,n)=>{let a=p(`li`,`fud-step${c&&n>0?` fud-stopped`:``}`),o=p(`p`,`fud-when`,`${f(d(y+t[n]*l))} · follow-up ${n+1} of 3 (day ${t[n]})`),u=p(`div`,`fud-mail`);u.append(p(`p`,`fud-meta`,`From: ${h||`Your business`}   To: ${r(g.name)}`),p(`p`,`fud-subj`,i(e.subject,g,_)));for(let t of i(e.body,g,_).split(`

`))u.append(p(`p`,`fud-body`,t));let m=p(`div`,`fud-btns`);for(let e of[b.yes,b.ask].filter(Boolean))m.append(p(`span`,`fud-fakebtn`,e));u.append(m),a.append(o,u),c&&n===0&&a.append(p(`p`,`fud-note`,`${r(g.name)} replies "Can you do the 18th?" The reply goes to your inbox and the next two follow-ups are canceled.`)),c&&n>0&&a.append(p(`p`,`fud-note`,`Not sent: the customer already replied.`)),s.append(a)}),o.hidden=!1}a?.addEventListener(`submit`,e=>{e.preventDefault(),m(!1),o?.scrollIntoView({behavior:`smooth`,block:`start`})}),c?.addEventListener(`click`,()=>m(!0));