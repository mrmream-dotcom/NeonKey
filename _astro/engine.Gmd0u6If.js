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

{signoff}`}]},t=[3,7,14],n={estimate:{yes:`Yes, let's go ahead`,ask:`I have a question`,pay:`Pay the deposit`},invoice:{yes:``,ask:`I have a question`,pay:`Pay the invoice`},inquiry:{yes:`Yes, let's set up a time`,ask:`I have a question`,pay:``}};function r(e){let t=String(e||``).trim().split(/\s+/)[0]||``;return!t||t.length>30||/[@\d<>]/.test(t)?`there`:t.charAt(0).toUpperCase()+t.slice(1)}function i(e,t,n){let i=t.amount?String(t.amount):``,a={first_name:r(t.name),job:t.job||(t.kind===`invoice`?`your recent job`:(t.kind,`your project`)),business:n.business||``,signoff:n.signoff||n.business||``,amount:i,amount_phrase:i?` (${i})`:``};return String(e).replace(/\{(first_name|job|business|signoff|amount_phrase|amount)\}/g,(e,t)=>a[t])}export{r as a,i,t as n,e as r,n as t};