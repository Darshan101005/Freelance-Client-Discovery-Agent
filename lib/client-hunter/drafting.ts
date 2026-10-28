import type {Lead} from './types';
export function composeDraft(lead:Lead,service:string,sender:string,proposal:any){
 const opening=lead.websiteStatus==='No site found'?`I came across ${lead.name} in ${lead.area} and couldn't find an official website during my search.`:`I came across ${lead.name} in ${lead.area} and had a look at your website. ${lead.issues?.[0]||'I have a few ideas for presenting your business online.'}`;
 const fallback=`I offer ${service.toLowerCase()}. A clear, easy-to-use website could give customers one place to learn about your business, see what you offer, and get in touch. I would be happy to discuss a simple approach that fits your business.`;
 const offer=typeof proposal.offer==='string'&&!/client hunter|researcher|guarantee|revenue|years of|award|proven|increase.*sales|your.*competitors/i.test(proposal.offer)?proposal.offer.slice(0,1500):fallback;
 return {subject:typeof proposal.subject==='string'?proposal.subject.slice(0,200):`A website idea for ${lead.name}`,body:`Hello ${lead.name} team,\n\n${opening}\n\n${offer||fallback}\n\nWould you be open to a short conversation about ${lead.website?'improving your website':'a website for your business'}?\n\nBest regards,\n${sender||'[Your name]'}`};
}
