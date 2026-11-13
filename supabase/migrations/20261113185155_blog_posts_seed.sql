-- Existing articles from landing/src/content/blog (and the unpublished drafts in
-- landing/blog), moved into public.blog_posts so the landing keeps serving them once it
-- reads from the database. Generated from the Markdown files at the commit that removed
-- them; image paths under /blog/ still point at the landing's static assets.
-- Published rows take their publication date as created_at/updated_at.
-- Idempotent: a row that already exists (same locale and slug) is left untouched.

INSERT INTO public.blog_posts
  (locale, slug, translation_key, content_type, status, title, description, author, category, tags, media, published_on, created_at, updated_at, body)
VALUES
('en', 'corelia-academy-rwa-tokenized-gold-hanoi-workshop-2026', 'rwa-tokenized-gold-hanoi-workshop-2026', 'blog', 'published', $md$Corelia Academy Joins an In-Depth RWA and Tokenized Gold Seminar in Vietnam$md$, $md$Corelia Academy’s founder attends a seminar on real-world asset (RWA) tokenization and gold tokenization co-hosted by the Vietnam Blockchain and Digital Assets Association and BinGold, bringing market-grounded perspectives into training programs.$md$, 'terran', 'career-ecosystem-insights', ARRAY['web3','ecosystem','blockchain-fundamentals','smart-contracts','career-tips']::text[], '{"type":"image","src":"/blog/rwa-vang-ma-hoa-hanoi-2026.jpg","alt":"Invitation to the in-depth seminar from the Vietnam Blockchain and Digital Assets Association and BinGold","fit":"contain","ogSrc":"/blog/og/rwa-vang-ma-hoa-hanoi-2026.jpg"}'::jsonb, '2026-04-04'::date, '2026-04-04'::timestamptz, '2026-04-04'::timestamptz, $md$As we build curricula and walk alongside developers entering Web3, Corelia Academy keeps repeating one idea: **mastering technology and code is only the foundation**. As the market matures, especially with the rise of **RWAs (real-world assets)**: the full picture has become far more multidimensional.

For builders, writing and deploying smart contracts to “tokenize” assets increasingly follows clear patterns and standards. The harder problems sit where the stack **meets the real world**: how oracles deliver trustworthy data; which legal frameworks protect investors; and above all, how custody and backing for physical assets are run in ways that traditional financial institutions can take seriously.

To capture the latest market knowledge and practical perspectives for our programs, **Corelia Academy’s founder** has accepted an invitation to an in-depth seminar focused on exactly these questions, using **gold** as a leading pilot use case.

![](/blog/rwa-vang-ma-hoa-hanoi-2026-thu-moi.jpg)

*Invitation to the in-depth seminar from the Vietnam Blockchain and Digital Assets Association, in partnership with BinGold.*

This is a chance for Corelia Academy to **listen and learn** from senior voices across finance, law, and operations. We hope to translate that into problem-solving mindsets for our learners: going beyond what a typical coding-only environment can offer.

## Event details

- **Topic:** RWA tokenization solutions and opportunities for tokenized gold in Vietnam  
- **Organizers:** Vietnam Blockchain and Digital Assets Association, in partnership with BinGold  
- **Time:** 1:30 PM – 4:30 PM, Tuesday, April 7, 2026  
- **Venue:** 1Matrix headquarters, 16th floor, Century Tower, Times City, Hanoi
$md$),
('en', 'corelia-academy-uef-strategic-mou-fit-career-day-2026', 'corelia-academy-uef-strategic-mou-fit-career-day-2026', 'blog', 'published', $md$A Strategic Partnership Milestone Between Corelia Academy and UEF: Opening a Hands-on Journey for the Next Generation$md$, $md$At FIT Career Day 2026, Corelia Academy and UEF officially signed an MOU, creating new opportunities for internships, in-depth training, and curriculum alignment with real business needs.$md$, 'terran', 'career-ecosystem-insights', ARRAY['ecosystem','mentorship','project-based','career-tips','web3']::text[], '{"type":"image","src":"/blog/UEF02310.jpg","alt":"Corelia Academy and UEF opening a hands-on learning journey for students at FIT Career Day 2026","ogSrc":"/blog/og/UEF02310.jpg"}'::jsonb, '2026-03-16'::date, '2026-03-16'::timestamptz, '2026-03-16'::timestamptz, $md$As part of **FIT Career Day 2026**, Corelia Academy and the **University of Economics and Finance Ho Chi Minh City (UEF)** officially signed a **Memorandum of Understanding (MOU)**, marking an important milestone in the connection between academia and industry. More than a ceremonial partnership, this agreement opens up concrete opportunities for UEF students to gain practical exposure, strengthen their professional capabilities, and prepare more confidently for a fast-changing job market.

You can also read UEF's official event coverage in this post on [FIT Career Day 2026](https://www.uef.edu.vn/tin-tuc-su-kien/khai-mac-fit-career-day-2026-ket-noi-sinh-vien-voi-gan-20-doanh-nghiep-cong-nghe-35307).

At Corelia Academy, education goes beyond transferring knowledge. We believe in hands-on, market-aligned learning, where students are exposed to real product thinking, real workflows, and real expectations from industry. Partnering with UEF is the next step in bringing that mindset into the university environment in a structured and long-term way.

## 1. A strategic MOU: Turning connection into concrete action

![](/blog/UEF02300.jpg)

The signing ceremony at FIT Career Day 2026 creates a foundation for both sides to launch practical collaboration instead of staying at the level of broad orientation. Through this agreement, Corelia Academy and UEF will work together to build a student development ecosystem that is closely aligned with real business needs.

The focus of this partnership is not only to widen access to learning opportunities, but also to help students engage earlier with the professional world. That early exposure is essential for narrowing the gap between classroom theory and the demands of the market.

## 2. Opening the door to internships and hands-on experience

![](/blog/UEF02371.jpg)

One of the most important highlights of this agreement is the opportunity for UEF students to join **real-world internships under the guidance of Corelia Academy's expert team**. Instead of only observing, students will be able to participate in a guided working environment, learning how to approach problem-solving, collaborate effectively, and execute tasks according to practical standards.

This model helps students build experience early, better understand their own strengths, and gain a stronger advantage as they enter their professional journey after graduation. For Corelia, it is also a meaningful way to help nurture a generation of young talent that is not only knowledgeable, but ready to act and create value.

## 3. Supporting the university through in-depth training

![](/blog/UEF02237.jpg)

Alongside internship opportunities, Corelia Academy will collaborate with UEF on **in-depth training activities**, including workshops, talk shows, and direct teaching and sharing sessions led by experts. These programs will give students closer access to market perspectives, emerging trends, and practical lessons drawn from real project implementation.

Having experts directly involved in teaching and sharing not only makes the content more engaging, but also creates a stronger bridge between academic learning and real application. Students will not just hear about careers, but understand how those careers actually operate in practice.

## 4. Working with UEF to keep the curriculum aligned with business needs

![](/blog/DSC02695.jpg)

Another long-term value of this MOU is Corelia Academy's role as a **program advisor**, working alongside UEF to help update training content in a more practical direction. With direct exposure to the market and experience working with young talent, Corelia can contribute insights that help the curriculum stay closer to recruitment demand and industry development trends.

This is an important step at a time when many students still face a gap between what they learn and what employers truly need. When academic programs are continuously updated with practical input, students gain a stronger advantage in adapting faster, working more effectively, and moving forward with greater confidence in their careers.

## Toward a resilient and breakthrough-ready young generation

![](/blog/DSC02573.jpg)

The partnership between Corelia Academy and UEF at FIT Career Day 2026 is not only a meaningful strategic milestone, but also a shared commitment to developing high-quality young talent. From internships and in-depth training to curriculum advisory support, every part of this collaboration is aimed at one outcome: helping students learn for real, work for real, and grow for real.

Corelia Academy believes that when universities and industry partners join hands in the right way, students are the ones who gain the greatest opportunities. From this milestone forward, a new journey has officially opened for the UEF student community: a journey of real exposure, hands-on learning, and career breakthrough.
$md$),
('en', 'corelia-academy-unihackfest-2026-hanoi-campus', 'corelia-academy-unihackfest-2026-hanoi-campus', 'blog', 'published', $md$Corelia Academy Joins UniHackfest 2026 Hanoi Campus to Empower Student Builders$md$, $md$As a strategic partner of UniHackfest 2026 Hanoi Campus, Corelia Academy helped connect students with knowledge, mentorship and hands-on product-building experiences.$md$, 'corelia-team', 'announcements-events', ARRAY['web3','ecosystem','mentorship','project-based','hackathon']::text[], '{"type":"image","src":"/blog/corelia-academy-dong-hanh-unihackfest-2026-hanoi-campus/IMG_2728.jpg","alt":"Corelia Academy joins UniHackfest 2026 Hanoi Campus","fit":"cover"}'::jsonb, '2026-07-24'::date, '2026-07-24'::timestamptz, '2026-07-24'::timestamptz, $md$On **July 24, 2026**, the **UniHackfest 2026 Hanoi Campus** workshop brought together technology-minded students in Hanoi for an energetic day of learning and connection. Joining the program as a **strategic partner**, Corelia Academy worked alongside organizations across the ecosystem to create a space where students could discover new knowledge and begin turning their observations into product ideas.

The event marked another stage in the UniHackfest 2026 journey, which develops student builders through learning, practice, mentorship and community connections. At Hanoi Campus, that mission came to life through practical discussions and a hands-on Mini Ideation Workshop.

## Expanding pathways for student builders

![Students explore the UniHackfest 2026 journey at Hanoi Campus](/blog/corelia-academy-dong-hanh-unihackfest-2026-hanoi-campus/IMG_2734.jpg)

The workshop introduced participants to the wider UniHackfest 2026 program, including its roadmap, learning tracks and opportunities to develop projects in the stages ahead. Students gained a clearer view of the process that connects identifying a problem with building and presenting a potential solution.

This approach also reflects how Corelia Academy supports technology communities: connecting knowledge with hands-on experience, bringing learners closer to industry experts and creating opportunities to develop capability through the act of building.

Within this wider journey, BK Fintech Hackday was introduced as a recurring platform for students interested in technology, the digital economy and innovation. It encourages solutions that can address practical challenges faced by businesses and society, giving students another environment in which to test their thinking and develop ideas.

## Technology begins with a real problem

![A practical technology session at UniHackfest 2026 Hanoi Campus](/blog/corelia-academy-dong-hanh-unihackfest-2026-hanoi-campus/IMG_2764.jpg)

Sessions throughout the event offered practical perspectives on **AI, Blockchain, Web3** and the product development journey. Participants were encouraged to observe market needs, choose meaningful problems and approach technology as a tool for creating value.

Insights from speakers and partner organizations also helped students understand how emerging technologies are contributing to the digital economy. Technical knowledge was connected with learning, career and project opportunities, giving participants more context as they considered their own development paths.

For a student builder, technical ability is essential but not sufficient on its own. Building also requires an understanding of users, a willingness to test assumptions, effective teamwork and the discipline to keep improving a solution. The workshop brought these elements together in one learning experience.

## Mini Ideation Workshop: where ideas began to take shape

![Students take part in the Mini Ideation Workshop at Hanoi Campus](/blog/corelia-academy-dong-hanh-unihackfest-2026-hanoi-campus/IMG_2773.jpeg)

Students did more than listen. During the **Mini Ideation Workshop**, they worked together to discuss and form their first ideas. Each group began with a problem they cared about, then explored its context, the people affected and a possible direction for a solution.

Feedback from the Organizing Committee, mentors and industry experts helped participants review assumptions, clarify their proposed value and continue developing their concepts with practical considerations in mind. It was a small but important step from learning about innovation to actively building.

The principle of **not only learning, but starting to build** also captures the value of project-based education. Knowledge becomes stronger when learners apply it directly, test an approach and improve their work in response to feedback.

## The strength of an ecosystem working together

![The UniHackfest 2026 Hanoi Campus community and partner ecosystem](/blog/corelia-academy-dong-hanh-unihackfest-2026-hanoi-campus/IMG_2783.jpg)

UniHackfest 2026 Hanoi Campus was made possible by the collaboration of educational institutions, communities and technology companies. Corelia Academy recognizes the contributions of:

- **Organizers:** Institute of Digital Technology and Economy - Hanoi University of Science and Technology; Youth Union of Hanoi University of Science and Technology; BK Fintech Club; and HIEC - HUST Innovation and Entrepreneurship Club.
- **Technology partners:** A-Star Group and AiPad Builder Ecosystem.
- **Supporting organization:** Finxdemy - Technology Training and Consulting.
- **Strategic partner:** Corelia Academy.
- **Sponsors:** MEXC Vietnam and Solana Developers Vietnam.

Corelia Academy also thanks the students, speakers, mentors and experts who made the day a meaningful opportunity to learn, exchange ideas and build new connections.

## Continuing the journey from idea to product

![Student builders continue their journey from ideas to products](/blog/corelia-academy-dong-hanh-unihackfest-2026-hanoi-campus/IMG_2759.jpg)

The Hanoi Campus workshop has concluded, but the development journey for its student builders is only beginning. Ideas formed during the event will need to be tested, refined and gradually turned into solutions capable of delivering practical impact.

As a strategic partner, Corelia Academy will continue to support UniHackfest 2026 and its community by connecting training with mentorship, hands-on practice and opportunities to develop projects. The goal is not only to help students understand technology, but also to give them the tools and environment to build confidently with it.

**Explore the journey and register your idea at [unihackfest.vn](https://unihackfest.vn/?utm_source=corelia.academy&utm_medium=referral&utm_campaign=unihackfest_2026&utm_content=hanoi_campus_recap).**
$md$),
('en', 'corelia-academy-van-lang-web3-dapp-workshop-2026', 'van-lang-web3-dapp-workshop-2026', 'blog', 'published', $md$Looking Back at the Web3 DApp Workshop at Van Lang University: When Students Become the Next Generation of Builders$md$, $md$Corelia Academy and CommandOSS co-hosted a Web3 DApp Workshop at Van Lang University (Mar 21, 2026), sharing foundational insights on digital assets, a practical Web3 roadmap, and a production-first builder mindset.$md$, 'terran', 'career-ecosystem-insights', ARRAY['web3','blockchain-fundamentals','dapp-development','ecosystem','career-tips','project-based']::text[], '{"type":"image","src":"/blog/vlu21032026.jpg","alt":"Web3 DApp Workshop at Van Lang University with Corelia Academy and CommandOSS","fit":"contain","ogSrc":"/blog/og/vlu21032026.jpg"}'::jsonb, '2026-03-21'::date, '2026-03-21'::timestamptz, '2026-03-21'::timestamptz, $md$On **March 21, 2026**, Van Lang University hosted an exciting **Web3 DApp Workshop**: a deep-dive learning and networking space **co-organized by Corelia Academy and CommandOSS**. The goal was simple: help students build a strong foundation so they can confidently step into the decentralized era.

![](/blog/vlu21032026-1.jpg)

Below are the most memorable highlights from two guest speaker sessions.

## 1) The digital asset landscape & a beginner-friendly Web3 roadmap

![](/blog/vlu21032026-2.jpg)

To open the program, **Terran Thai: Founder of Corelia Academy** shared a big-picture view of Vietnam’s position on the global blockchain map. With crypto adoption reaching **around 20% (Top 4 worldwide)** and a regulatory framework gradually taking shape, this is a strong “window of opportunity” for the next generation to move early.

One core idea was the difference between **traditional assets** and **digital assets**. In Web3, ownership is brought back to the user through **self-custody** (holding assets via private keys), enabling on-chain transparency and 24/7 global markets without borders.

To help students avoid feeling overwhelmed, Corelia Academy introduced a practical **6-stage roadmap**:

- **Foundation**: Build strong blockchain fundamentals. Choose a Tech or Non-Tech track.
- **Direction**: Start producing real outputs (deploy contracts, write case studies, etc.).
- **Execution**: Join hackathons and collaborate with project teams.
- **Exposure**: Go deeper into DeFi, NFTs, RWAs, and more.
- **Specialization**: Build a strong personal portfolio and positioning.
- **Create value**: Become a true builder and contribute to the ecosystem.

## 2) A production mindset & what blockchain really is

![](/blog/vlu21032026-3.jpg)

Next, **Harry Phan: Software Engineer at CommandOSS** helped IT students demystify Web3 architecture through a simple, memorable analogy: **“In Web3, blockchain plays a role similar to a database in Web2.”**

Instead of relying on a centralized server, where censorship, unexpected fee increases, or outages can become a single point of failure: dApps and smart contracts store and verify state in a decentralized way. Transactions are authorized via digital signatures and packaged into linked blocks, forming a secure consensus network.

Harry also strongly encouraged students to join **hackathons**. Unlike traditional education paths that often stretch the gap between “learning” and “building,” hackathons compress it. In that environment, a **production-first mindset** matters most: a builder’s goal is not just to understand theory, but to **ship real products under tight time constraints**.

## Closing thoughts

![](/blog/vlu21032026-4.jpg)

The Web3 DApp Workshop at Van Lang University may have ended, but students’ journeys in the decentralized world are only beginning. Their energy, sharp questions, and willingness to learn are strong signals of a promising new generation of Vietnamese **Web3 builders**.

Ready to write your next chapter in Web3?
👉 Join our learning-and-building ecosystem at: https://app.corelia.academy
$md$),
('en', 'corelia-launches-web3-engineer-training-program-at-itc-2026', 'corelia-trien-khai-chuong-trinh-dao-tao-ky-su-web3-tai-itc-2026', 'blog', 'published', $md$Corelia Launches Web3 Engineer Training Program at ITC: Learn, Build, and Ship Real Products$md$, $md$Corelia's Web3 engineer training program at ITC takes students from building smart contracts with Sui Move and creating tokens to developing dApps and preparing for the Web3 Builders Hackathon.$md$, 'corelia-team', 'career-ecosystem-insights', ARRAY['web3','smart-contracts','move-language','dapp-development','project-based','hackathon']::text[], '{"type":"image","src":"/blog/corelia-itc-training-2026/corelia-itc-training-2.jpg","alt":"Web3 Engineer training program at ITC","fit":"cover"}'::jsonb, '2026-04-29'::date, '2026-04-29'::timestamptz, '2026-04-29'::timestamptz, $md$ITC students are officially stepping into Web3 through a Web3 engineer training program **delivered by Corelia** and built around a simple principle: **learn by doing, build with purpose, and ship real products**. Across the program's in-depth Sessions 2, 3, and 4, blockchain moves beyond presentation slides and becomes a technology students can use to write code, create digital assets, develop applications, and solve practical problems.

The program is not designed to turn students into experts after only a few sessions. Its goal is to help them build the right foundations, practice one step at a time, and understand how a Web3 product comes together: from on-chain smart contract logic to the interface users interact with in a browser.

## 1. Moving Blockchain Beyond Theory

![Web3 Engineer classroom at ITC](/blog/corelia-itc-training-2026/corelia-itc-training-3.jpg)

For many information technology students, terms such as blockchain, smart contract, token, and dApp are already familiar from news, online communities, and social media. Yet there is still a considerable gap between having heard of these concepts and being able to build with them.

Corelia delivers this training series at ITC to help close that gap. Each topic is tied to a practical outcome. Students do not merely learn what a smart contract is; they write and deploy one. They do not simply hear about tokens; they create one. They do not only examine how a dApp works; they progressively build an interface, connect a wallet, and display blockchain data on the web.

This hands-on approach allows students to see how the essential parts of a complete Web3 application fit together:

- A **smart contract** defines the application's rules and on-chain logic.
- **Digital assets** are represented, managed, and transferred according to transparent conditions.
- A **Web3 wallet** allows users to authenticate themselves and sign transactions.
- A **dApp interface** creates an accessible experience through which users can interact with on-chain data.

This also marks an important shift in how students learn: from memorizing individual concepts to understanding a system, and from following instructions to developing the ability to create a product of their own.

## 2. Building Smart Contracts with Sui Move

![ITC students programming with Sui Move](/blog/corelia-itc-training-2026/corelia-itc-training-4.jpg)

One of the program's core modules focuses on smart contract development with **Sui Move**. Students learn how to model digital assets, implement transaction logic, and understand how data is managed in a blockchain environment.

Rather than treating a digital asset as a number stored in a centralized database, students explore how Sui Move represents assets as objects with clear owners, properties, and interaction rules. This gives them a deeper understanding of digital ownership, transparency, and the role smart contracts play in ensuring that rules are executed consistently.

Writing and testing smart contracts also trains students to think more rigorously about software. Every state change, access condition, and operation involving an asset must be designed intentionally. This mindset provides an essential foundation for exploring more advanced Web3 applications in the future.

## 3. Creating Tokens and Understanding Digital Assets

![ITC students practicing Sui Move programming](/blog/corelia-itc-training-2026/corelia-itc-training-6.jpg)

After learning the fundamentals of smart contracts, students move on to creating their own **tokens**. This exercise makes cryptocurrencies and digital assets more tangible. A token is not simply a name or symbol; it is a programmable set of rules defining how an asset is created, circulated, and used.

Through the practical assignment, students explore several important components:

- How to define and initialize a new type of digital asset.
- How tokens are issued, owned, and transferred between wallet addresses.
- How smart contracts control supply and permissions.
- How transaction data is recorded, verified, and displayed on a blockchain.

More importantly, students begin to see a token as part of a product rather than merely something to trade. Depending on the problem being solved, a token can represent access rights, reward points, in-game assets, certificates, or many other forms of digital value. This product-oriented perspective opens a much broader space for creativity.

## 4. Developing a dApp Interface and Connecting a Wallet

![ITC students practicing Sui Move programming](/blog/corelia-itc-training-2026/corelia-itc-training-5.jpg)

A smart contract becomes a usable product only when people can interact with it. The program therefore takes students into the application layer through hands-on work in **dApp interface development, wallet integration, and blockchain data display**.

At this stage, familiar web development skills are connected to blockchain infrastructure. Students learn how an interface recognizes a user's wallet, sends requests to a smart contract, and reflects transaction results on screen. Actions such as connecting a wallet, reading on-chain data, and displaying owned assets help students understand the full flow of a dApp from end to end.

This is an important milestone in the learning journey. The project is no longer a collection of isolated code snippets. It begins to take shape as a product with an interface, an interaction flow, and something that can be demonstrated for others to experience.

<!-- IMAGE_SLOT: Replace this comment with: ![Students building a dApp interface and connecting a wallet](/blog/IMAGE-NAME.jpg) -->

## 5. From Individual Exercises to Collaborative Product Building

Alongside technical development, the program places strong emphasis on teamwork and product thinking. Students work together to develop ideas, define the problems they want to solve, divide responsibilities, and prepare for the hackathon stage.

Within a Web3 product team, members may take responsibility for different areas, including smart contracts, front-end development, user experience, user research, pitching, or project coordination. Working across these roles helps students recognize that a successful product needs more than functional code. It must address a clear need and communicate its value convincingly.

The team-based process also gives students opportunities to practice essential skills used in real technology environments:

- Turning an early idea into a product scope that can realistically be delivered.
- Dividing responsibilities according to each member's strengths.
- Connecting smart contracts, data, and interfaces into one complete flow.
- Testing the product, gathering feedback, and improving it under time constraints.
- Preparing a clear demonstration and communicating the solution's value.

## 6. A Web3 Starting Point for Beginners

One of the program's key advantages is that **students do not need prior Web3 experience**. The learning path is structured in layers, helping participants understand core principles before moving into more complex practical assignments.

Instead of expecting students to master every concept from the beginning, the program encourages experimentation: writing the first lines of code, encountering errors, finding their causes, fixing them, and observing the results. This repeated process helps knowledge stick while building the confidence required to become a builder.

Students also learn directly from experts from **Corelia, Sui, and CommandOSS**, gaining access to foundational knowledge, product development experience, and practical perspectives from the blockchain ecosystem. This support gives participants a clearer direction: what to learn, how to practice, and which skills they need to develop to progress further in Web3.

## 7. Preparing for the Web3 Builders Hackathon

The training sessions are not the final destination. In the next stage, students will enter a hands-on environment at a company through the **Web3 Builders Hackathon**, where teams will apply everything they have learned to turn an idea into a product they can demonstrate live.

A hackathon is a comprehensive test of technical ability, product thinking, and collaboration. Within a limited amount of time, students must define a problem, choose the core features, build a smart contract, complete an interface, and prepare a presentation. Time pressure teaches teams to prioritize what matters, make decisions quickly, and continuously improve based on feedback.

The greatest value of this stage goes beyond the competition results. Every completed product becomes tangible evidence of a student's skills, helping them build a portfolio, understand the product development process, and enter professional environments with greater confidence.

<!-- IMAGE_SLOT: Replace this comment with: ![Student teams preparing for the Web3 Builders Hackathon](/blog/IMAGE-NAME.jpg) -->

## 8. Connecting Education, Industry Experts, and the Ecosystem

The program is **delivered by Corelia at ITC**, in coordination with the institution and with professional support from **Sui, CommandOSS, and blockchain industry experts**. This model connects academic knowledge, hands-on experience from technology teams, and opportunities to practice within the wider Web3 ecosystem.

Through the training series, students gain more than exposure to a new technology. They are placed in an environment designed for growth: a structured learning path, expert guidance, teammates to collaborate with, and a clear product goal.

## Conclusion

![ITC students practicing Sui Move programming](/blog/corelia-itc-training-2026/corelia-itc-training-1.jpg)

From building smart contracts with Sui Move and creating tokens to developing dApp interfaces and connecting wallets, ITC students are progressively mastering the process of creating a Web3 application. Each session represents a step from knowledge to skill, from idea to product, and from learner to builder.

The upcoming **Web3 Builders Hackathon** will put that learning to the test in a real-world environment. Ideas that currently exist on paper will be translated into code, developed into working products, and presented to the community.

The Web3 engineer journey at ITC has truly begun: not only through lectures, but through the products students are building themselves.
$md$),
('en', 'corelia-stellar-apac-hackathon-vietnam-demo-day-2026', 'corelia-stellar-apac-hackathon-vietnam-demo-day-2026', 'blog', 'published', $md$Vietnam Demo Day 2026: Corelia Supports the Stellar APAC Hackathon$md$, $md$On July 18, 2026, Vietnam's Stellar APAC Hackathon Demo Day brought together 150+ attendees, 75 submissions, and 60 project pitches, with Corelia Academy supporting the program locally.$md$, 'corelia-team', 'announcements-events', ARRAY['web3','ecosystem','mentorship','hackathon','dapp-development']::text[], '{"type":"image","src":"/blog/corelia-stellar-apac-hackathon-vietnam-demo-day-2026/SHJ_4139.jpg","alt":"Builders and organizers at the Stellar APAC Demo Day in Vietnam","fit":"cover"}'::jsonb, '2026-07-18'::date, '2026-07-18'::timestamptz, '2026-07-18'::timestamptz, $md$On **July 18, 2026**, three Demo Days took place at the same time in **Vietnam, Indonesia, and the Philippines**. Each room had its own community and energy, but all three were part of the same story: the largest Stellar hackathon ever hosted in the APAC region.

The simultaneous events were designed as a beginning rather than a finish line. The program set out to identify founders worth supporting for the long term and to turn a hackathon into a lasting builder pipeline. In Vietnam, the stage brought together teams that had spent weeks transforming early ideas into functional products and preparing to explain why those products should exist.

The **APAC Stellar Hackathon** was run by **Rise In together with the Stellar Development Foundation**. **Corelia Academy supported the program in Vietnam**, helping strengthen the local connection among builders, mentors, ecosystem partners, and the wider technology community.

## Vietnam Demo Day by the Numbers

Vietnam Demo Day reflected strong participation from across the local builder ecosystem:

- **150+ attendees**, including builders, mentors, ecosystem partners, and community members
- **75 project submissions** from across Vietnam
- **60 projects pitched** across morning and afternoon sessions
- **4 judges**, including 2 external judges from Chainlink and Spartan
- **Top 10 projects selected** to advance to the APAC Grand Finale

The figures tell only part of the story. Presenting 60 projects across two sessions gave the judges and ecosystem partners an opportunity to understand not only what teams had built, but also how they approached problems, responded to questions, and thought about the next stage of their products.

At that point in the program, the Vietnam Top 10 were preparing to join the strongest teams from Indonesia and the Philippines at the **APAC Grand Finale on July 31, 2026**, competing as part of the program's total **$60K prize pool**.

## The Road to Demo Day

![A team presenting its product at the Stellar APAC Demo Day in Vietnam](/blog/corelia-stellar-apac-hackathon-vietnam-demo-day-2026/SHJ_3763.jpg)

A Demo Day can make the journey look like a five-minute presentation. In reality, the most important work happened during the weeks leading up to the stage.

Across Vietnam, Indonesia, and the Philippines, the hackathon operated as a complete builder program. It included developer workshops, community meetups, university activations, and online events open to participants across APAC. Along the way, founders received support, faced technical and product challenges, and continually refined what they were building.

The brief was deliberately demanding. Teams were expected to develop **functional, user-facing financial applications** with practical utility for real people. The projects explored areas such as payments and everyday financial tools relevant to Southeast Asia. The standard was not simply whether a concept used blockchain, but whether it solved a meaningful problem well enough that someone might actually use it.

By Demo Day, each participating team had already completed the hardest steps: turning an initial observation into a clear product direction, building a working application from the ground up, and preparing a pitch capable of communicating both its value and its technical execution.

## More Than a Project Ranking

Vietnam Demo Day was designed to do more than rank submissions. Live pitches and Q&A offered a much deeper view of the builder community than a submission form alone could provide.

The evaluation process helped the program:

- identify high-potential founders interested in building on Stellar over the long term
- assess product quality and technical execution ahead of the Grand Finale
- understand builders' motivations, challenges, and future support needs
- develop relationships with promising teams for grants, mentorship, ecosystem introductions, and potential mainnet deployment
- create a sustainable pipeline that could continue beyond a single hackathon

This longer-term perspective mattered. A promising prototype can be the beginning of a product, but teams often need continued feedback, technical support, introductions, and opportunities to test their ideas with real users before they can move forward.

## Corelia's Role in Supporting the Vietnam Builder Community

As a local supporting partner, **Corelia Academy contributed to the Vietnam program by helping connect the hackathon with the country's builder and technology community**. This support aligned with Corelia's broader work of bringing practical learning opportunities, mentorship, and ecosystem access closer to emerging builders.

For Corelia, an event creates lasting value when participants leave with more than a ranking. Builders should gain clearer product direction, stronger relationships, useful feedback, and a path to continue developing what they started. Vietnam Demo Day created that kind of environment by bringing teams into direct conversation with judges, mentors, and ecosystem representatives.

The two full pitching sessions also revealed the depth of Vietnam's builder community. Beyond technical ability, teams demonstrated product vision, persistence, and a serious interest in building for the long term. Those qualities formed a strong pipeline heading toward the Grand Finale and the ecosystem opportunities that could follow.

## From Demo Day to a Longer Journey

Vietnam Demo Day marked a major milestone for the participating teams, but it was never intended to be the end of the journey. The Top 10 advanced with working products, clearer narratives, and direct feedback they could use to strengthen their next pitch.

Corelia Academy was glad to support the program in Vietnam and to stand alongside the builders, mentors, judges, and ecosystem partners who made the day possible. The energy on July 18 showed what can happen when a hackathon is treated not as a one-off competition, but as an entry point into a longer path of learning, building, and contributing to the Stellar ecosystem.
$md$),
('en', 'corelia-uef-launch-unihackfest-unitour-2026', 'corelia-uef-khoi-dong-unihackfest-unitour-2026', 'blog', 'published', $md$UEF and Corelia Academy Launch UniHackFest 2026: A Journey into AI and Web3$md$, $md$On June 15, 2026, UEF and Corelia Academy launched UniHackFest 2026, beginning a 14-week journey of learning, hands-on experience, and AI, Blockchain, and Web3 project development for students nationwide.$md$, 'corelia-team', 'announcements-events', ARRAY['web3','blockchain-fundamentals','dapp-development','ecosystem','project-based','hackathon']::text[], '{"type":"image","src":"/blog/corelia-uef-khoi-dong-unihackfest-unitour-2026/UEF01929.jpg","alt":"UEF and Corelia Academy launch UniHackFest 2026","fit":"cover"}'::jsonb, '2026-06-15'::date, '2026-06-15'::timestamptz, '2026-06-15'::timestamptz, $md$On the morning of **June 15, 2026**, the University of Economics and Finance, Ho Chi Minh City (UEF), in partnership with **Corelia Academy**, held the launch ceremony for the **“Web3 Hackathon for Students – UniHackFest 2026.”** The event marked the beginning of a nationwide technology competition for students passionate about innovation and opened a 14-week journey of learning, hands-on experience, and project development across AI, Blockchain, Web3, and digital assets.

The program brought together technology experts, business representatives, lecturers, and a large number of students. More than simply introducing a competition, the launch gave students access to emerging technology trends, connected them with a professional ecosystem, and helped them envision a clearer path from ideas to practical products.

![UEF and Corelia Academy launch UniHackFest 2026: A journey into AI and Web3](/blog/corelia-uef-khoi-dong-unihackfest-unitour-2026/_DSC0755.jpg)

## Launching a Nationwide Technology Competition for Students

Representing UEF at the event were **Dr. Nhan Cam Tri – Vice President**; **Dr. Van Thi Thien Trang – Vice Dean of the Faculty of Information Technology**; and **Ms. Hoang Thi Hang – Assistant to the Dean of the Faculty of Information Technology**, alongside lecturers and a large number of students.

The program also welcomed **Prof. Dr. Nguyen Tan Anh – Director of the UNESCO Center for Science, Technology, and Development Investment Consultancy**; **Mr. Thai Pham Ngoc Tuong – Founder of Corelia Academy**; **Ms. Phan Nguyen Mai Anh – Co-Founder of Corelia Academy**; and representatives from MEXC Ventures, Solana Foundation, Open Campus, Chainlink Labs, OLYM3, CommandOSS, LazorKit, and partner universities and colleges.

In his opening remarks, Dr. Nhan Cam Tri emphasized that UniHackFest 2026 aims to create an academic and technology platform for students across Vietnam. In a practical environment, participants can explore AI, Blockchain, and Web3; strengthen their professional, research, and creative capabilities; and connect with businesses and technology experts to expand their future career opportunities.

![UEF and Corelia Academy launch UniHackFest 2026: A journey into AI and Web3](/blog/corelia-uef-khoi-dong-unihackfest-unitour-2026/UEF01244.jpg)

Prof. Dr. Nguyen Tan Anh also spoke about the role of young people in mastering and creating technology in the digital era, encouraging students to take an active role in exploring emerging fields.

![UEF and Corelia Academy launch UniHackFest 2026: A journey into AI and Web3](/blog/corelia-uef-khoi-dong-unihackfest-unitour-2026/UEF01311.jpg)

## A 14-Week Journey of Learning, Experience, and Project Development

During the launch ceremony, **Mr. Thai Pham Ngoc Tuong – Founder of Corelia Academy** introduced UniHackFest 2026 and its 14-week roadmap, designed to connect learning with hands-on practice and product development.

![UEF and Corelia Academy launch UniHackFest 2026: A journey into AI and Web3](/blog/corelia-uef-khoi-dong-unihackfest-unitour-2026/_DSC0898.jpg)

Participants will progress through **UniTour, Bootcamp Learning, Digital Assets Market, Solana Bootcamp, presentation skills classes, specialized mentoring workshops, the Qualification Round, and Demo Day**. Alongside the learning and competition activities, students will have opportunities to connect directly with experts, companies, and communities across the technology ecosystem.

The roadmap helps teams gradually refine their ideas, build knowledge, develop projects, and become familiar with a professional innovation environment. Instead of entering a short competition with little preparation, students have time to strengthen their product thinking, technical execution, and presentation skills.

## A Panoramic View of the Solana Ecosystem

Joining online from South Korea, **Ms. Chaerin Kim – Developer Relations Specialist at Solana Foundation** presented **“The Solana Builder Ecosystem.”** Her session offered an overview of the Solana development ecosystem and the opportunities available to young developers across Asia.

![UEF and Corelia Academy launch UniHackFest 2026: A journey into AI and Web3](/blog/corelia-uef-khoi-dong-unihackfest-unitour-2026/UEF01620.jpg)

Through the lens of a global technology ecosystem, the presentation helped students better understand how builder communities operate, what resources are available to developers, and how Vietnam's younger generation can participate.

The program continued with **Mr. Pham Minh Tuan – External Developer Advocate at Solana Foundation**, who delivered **“Building on Solana: Why Now, Why Vietnam.”** He examined Vietnam's advantages in the global technology race, the development of the Solana ecosystem, and the growing demand for highly skilled talent in Blockchain and Web3.

![UEF and Corelia Academy launch UniHackFest 2026: A journey into AI and Web3](/blog/corelia-uef-khoi-dong-unihackfest-unitour-2026/UEF01644.jpg)

These practical perspectives helped students identify career opportunities and understand the knowledge and skills they need to participate in building emerging technology products.

## Digital Assets and the New Wave of Technology

From a market perspective, **Ms. Jenny Nguyen – Head of Marketing and Strategic Partnerships at MEXC Ventures** presented **“Digital Assets: The New Wave of Technology.”**

![UEF and Corelia Academy launch UniHackFest 2026: A journey into AI and Web3](/blog/corelia-uef-khoi-dong-unihackfest-unitour-2026/UEF01580.jpg)

The session examined digital asset trends and the opportunities Blockchain technology is opening for younger generations. It encouraged students to see digital assets not merely as a market movement, but as a technology sector creating new product models, career paths, and talent needs.

The presentation also prompted participating teams to observe the market, identify meaningful problems, and explore opportunities to apply technology to real-world needs.

## Edu Chain and Digital Credentials in Education

**Mr. Cris Tran – Core Contributor at Open Campus and Co-Founder & CGO of MoneyFi and S.H.E Blockchain** introduced the **Edu Chain** model and digital credential systems.

![UEF and Corelia Academy launch UniHackFest 2026: A journey into AI and Web3](/blog/corelia-uef-khoi-dong-unihackfest-unitour-2026/UEF01691.jpg)

The session helped students better understand Blockchain's potential applications in education and workforce development. The technology can help record and verify learning journeys, skills, and achievements in new ways, supporting transparent capability profiles and stronger connections to career opportunities.

It also provided a relatable example of how Blockchain can solve practical problems beyond finance, broadening the creative space available to UniHackFest 2026 teams.

## A Conversation About Technology, Careers, and Project Development

Before the event concluded, an interactive discussion drew numerous questions from students about AI and Web3 trends, career opportunities in technology, and practical experience in building and developing projects.

![UEF and Corelia Academy launch UniHackFest 2026: A journey into AI and Web3](/blog/corelia-uef-khoi-dong-unihackfest-unitour-2026/_DSC1075.jpg)

![UEF and Corelia Academy launch UniHackFest 2026: A journey into AI and Web3](/blog/corelia-uef-khoi-dong-unihackfest-unitour-2026/UEF01864.jpg)

Direct conversations with the experts gave students practical perspectives on the industry and its talent needs. They also encouraged participants to pursue creative ideas with confidence, find teammates, and take on the challenge of the competition.

## From Creative Ideas to Products with Real-World Value

![UEF and Corelia Academy launch UniHackFest 2026: A journey into AI and Web3](/blog/corelia-uef-khoi-dong-unihackfest-unitour-2026/UEF01922.jpg)

With support from technology organizations, companies, and experts from Vietnam and abroad, UniHackFest 2026 is more than a competition. It is an environment where students can discover their potential, build technical capabilities, and gradually turn ideas into reality.

Beginning at UEF, the 14-week journey is expected to become a launchpad that brings breakthrough ideas closer to products with practical value while contributing to the development of a highly skilled technology workforce for the digital era.

Corelia Academy will continue working alongside UEF, its partners, and the community throughout this journey, connecting education with hands-on experience and project development opportunities for students nationwide.

**Explore the roadmap and register at [unihackfest.vn](https://unihackfest.vn/?utm_source=corelia.academy&utm_medium=referral&utm_campaign=unihackfest_2026&utm_content=uef_kickoff_recap).**

*Reference: [UEF launches UniHackFest 2026, opening a journey into AI and Web3 for students nationwide](https://www.uef.edu.vn/tin-tuc-su-kien/uef-khoi-dong-unihackfest-2026-mo-ra-hanh-trinh-chinh-phuc-ai-va-web3-cho-sinh-vien-toan-quoc-36846).*
$md$),
('en', 'corelia-uii-innovation-talk-ueh-ai-web3-career-2026', 'corelia-uii-innovation-talk-ueh-ai-web3-career-2026', 'blog', 'published', $md$Corelia Academy Joins UII Innovation Talk at UEH$md$, $md$On August 6, 2026, Corelia Academy joined UniHackFest, Open Campus, and MEXC Ventures at UII Innovation Talk at UEH to explore careers in AI, Web3, and digital assets.$md$, 'corelia-team', 'announcements-events', ARRAY['web3','ecosystem','mentorship','project-based','career-tips','hackathon']::text[], '{"type":"image","src":"/blog/corelia-uii-innovation-talk-ueh-ai-web3-career-2026/DJI_20260806111315_0237_D.jpg","alt":"Corelia Academy joins UII Innovation Talk on AI, Web3, and digital asset careers at UEH","fit":"cover"}'::jsonb, '2026-08-06'::date, '2026-08-06'::timestamptz, '2026-08-06'::timestamptz, $md$On the morning of **August 6, 2026**, **UII Innovation Talk: Navigating Your Career in AI, Web3 and Digital Assets** took place at **UEH**, connecting students with practical perspectives on markets, technology, and career development.

**Corelia Academy, UniHackFest, Open Campus**, and **MEXC Ventures** joined the program as part of the Field Study module within UEH's Technology and Innovation curriculum. Through expert sessions, group work, a Fireside Chat, and live Q&A, students explored how to choose a suitable role and turn academic knowledge into practical capability.

## Viewing the Digital Asset Market Through Career Opportunities

![Jenny Nguyen shares digital asset opportunities with students at UII Innovation Talk](/blog/corelia-uii-innovation-talk-ueh-ai-web3-career-2026/DJI_20260806093719_0105_D.jpg)

In the opening talk, **Jenny Nguyễn** explored opportunities for Vietnamese students as the digital asset regulatory landscape develops in 2026.

The market's growth creates demand for a broad range of capabilities. In addition to engineering, the ecosystem needs people working in research, product, strategy, market analysis, communication, and community development. Students can therefore begin with their existing strengths while expanding their understanding of technology, users, and market context.

This multidisciplinary view also reflects Corelia Academy's approach to builder education. Strong technology teams combine different areas of expertise to understand a problem and build a solution that creates value.

## Mini Ideathon: Turning Research into Product Direction

![Students take part in the Research to Strategy Mini Ideathon at UEH](/blog/corelia-uii-innovation-talk-ueh-ai-web3-career-2026/DJI_20260806100029_0155_D.jpg)

During the **Mini Ideathon: Research to Strategy**, hosted by **MEXC Ventures**, students worked in groups to study trends, identify market opportunities, and propose product strategies across AI, Web3, and digital assets.

The activity introduced an important part of the product-building process. Research is more than finding and summarizing information. A team must determine what matters, which opportunities fit the context, and how an insight can become a direction for action.

Connected with product thinking, research provides a foundation for selecting a problem, identifying users, and making informed decisions. This capability is valuable to both technical and non-technical members of an innovation team.

## AI and the Ability to Adapt

![Cris D. Tran discusses AI and the future of young professionals](/blog/corelia-uii-innovation-talk-ueh-ai-web3-career-2026/DJI_20260806101931_0181_D.jpg)

**Cris D. Tran** continued the program with a session on AI as both a competitor and potentially the most powerful copilot available to young people.

AI is changing the way we learn and work. Some tasks can be automated faster, while the same technology can help students research, experiment, and create more effectively. Adapting therefore means more than learning to use a tool; it also requires critical thinking, domain knowledge, and the ability to evaluate outputs.

When students place AI within a clear workflow, they can accelerate learning and product development while remaining responsible for judgment and decision-making.

## Developer Lead, Product, and Research on One Team

![Fireside Chat on Developer Lead, Product, and Research roles in AI and Web3](/blog/corelia-uii-innovation-talk-ueh-ai-web3-career-2026/DJI_20260806110510_0216_D.jpg)

![Thái Phạm Ngọc Tường and Cris D. Tran at UII Innovation Talk](/blog/corelia-uii-innovation-talk-ueh-ai-web3-career-2026/DJI_20260806105645_0209_D.jpg)

In the Fireside Chat, **Thái Phạm Ngọc Tường** and **Cris D. Tran** discussed the roles of **Developer Lead, Product, and Research** in the AI and Web3 era.

A Developer Lead guides technical decisions and helps ensure that a solution can be implemented. Product connects user needs with goals and development priorities. Research provides the evidence, context, and analysis a team needs to avoid building on assumptions alone.

The three roles represent distinct but closely connected capabilities. A product needs to be built well, but the team must first determine whether it is solving the right problem and why its chosen direction matters.

The Q&A gave students an opportunity to ask about skills, career choices, and preparation for the AI and Web3 market. It connected the program's broader ideas with decisions each learner may need to make.

## UniHackFest 2026: Turning Direction into Experience

![Introducing the UniHackFest 2026 journey to UEH students](/blog/corelia-uii-innovation-talk-ueh-ai-web3-career-2026/DJI_20260806104036_0189_D.jpg)

The program also introduced **UniHackFest 2026**, including its competition themes, team roles, and ways for students to begin building with Web3 and AI.

Career direction becomes clearer when it is tested through experience. By contributing to a project, students can better understand their strengths, learn to collaborate across roles, and produce tangible work for their portfolios.

UII Innovation Talk is part of the Field Study module running from July 27 to September 15, 2026 within UEH's Technology and Innovation program. Practical activities connect theory with business environments, strengthen observation, teamwork, and presentation skills, and prepare students for internships and future careers.

Corelia Academy appreciates the opportunity to join UEH, UniHackFest, Open Campus, and MEXC Ventures in this meaningful academic program. We will continue connecting students with practical knowledge, mentorship, and environments in which they can build products.

![Students and speakers at UII Innovation Talk at UEH](/blog/corelia-uii-innovation-talk-ueh-ai-web3-career-2026/DJI_20260806091004_0079_D.jpg)

**Explore the UniHackFest 2026 journey at [unihackfest.vn](https://unihackfest.vn/?utm_source=corelia_blog&utm_medium=content&utm_campaign=unihackfest_2026&utm_content=uii_innovation_talk_ueh_recap_en).**
$md$),
('en', 'corelia-unihackfest-da-nang-campus-2026', 'corelia-unihackfest-da-nang-campus-2026', 'blog', 'published', $md$UniHackFest Da Nang Campus 2026: From Market Opportunities to Product Ideas$md$, $md$On August 17, 2026, UniHackFest Da Nang Campus connected students with Digital Assets, Solana, and product thinking through a Mini Ideation Sprint, Q&A, and networking at BTEC FPT Da Nang.$md$, 'corelia-team', 'announcements-events', ARRAY['web3','blockchain-fundamentals','dapp-development','ecosystem','mentorship','hackathon']::text[], '{"type":"image","src":"/blog/corelia-unihackfest-da-nang-campus-2026/IMG_1999.jpg","alt":"Students and speakers at UniHackFest Da Nang Campus 2026","fit":"cover"}'::jsonb, '2026-08-17'::date, '2026-08-17'::timestamptz, '2026-08-17'::timestamptz, $md$On the afternoon of **August 17, 2026**, **UniHackFest Da Nang Campus 2026** took place at **BTEC FPT Da Nang**, creating an accessible space for students to explore Digital Assets, Blockchain, and Solana through a product lens. Rather than beginning with complex technical material, the program guided participants from identifying a market opportunity to shaping an idea they could continue to research and develop.

The event was organized by **Corelia Academy, BTEC FPT, and DUT Superteam University Club**, sponsored by **MEXC Ventures and Solana Foundation**, with the participation of **FIC – Financial Investing Club, FPT Da Nang**. Over more than three hours, students joined speakers, mentors, and the builder community for expert sessions, hands-on ideation, open discussion, and networking.

## Expanding collaboration to bring technology opportunities closer to students

Following the welcome remarks from BTEC FPT, the program marked a new milestone through memorandum of understanding signing ceremonies between **Corelia Academy and BTEC FPT**, and between **Corelia Academy and GALAXY Communications & Events**.

These collaborations aim to create more practical learning opportunities where students can access emerging knowledge, meet industry experts, and gradually turn what they learn into products. For Corelia Academy, collaboration among universities, communities, and industry partners is an important foundation for developing young builders who understand markets and can take the initiative in creating solutions.

## Viewing Digital Assets through opportunities for student builders

![UniHackFest Da Nang Campus 2026: From Market Opportunities to Product Ideas](/blog/corelia-unihackfest-da-nang-campus-2026/IMG_1751.jpg)

In **“Digital Assets & Opportunities for Student Builders,” Ms. Theon of MEXC Ventures** helped students examine the digital asset market from the perspective of a product builder.

Rather than simply following market movements or trends, a builder needs to observe unresolved problems, understand user needs, and assess where technology can create meaningful value. This approach makes Digital Assets and Blockchain more approachable: they are not only technology topics, but also a product space filled with practical problems waiting to be explored.

## Mini Ideation Sprint: accelerating from problem to idea

Immediately after the market session, students joined the **MEXC Ventures Mini Ideation Sprint**. Teams brainstormed, selected an opportunity, defined a problem to address, and outlined a product concept with direct support from Ms. Theon and the mentors.

The activity gave participants a compact product-thinking cycle: begin with a market observation, ask questions about the user, formulate a solution, and present the idea for feedback. The value of an Ideation Sprint is not to produce a perfect concept in a short time. It is to turn an initial observation into a hypothesis clear enough to test and improve.

## Solana for everyone and the anatomy of a practical application

![UniHackFest Da Nang Campus 2026: From Market Opportunities to Product Ideas](/blog/corelia-unihackfest-da-nang-campus-2026/IMG_1817.jpg)

The **“Solana for Everyone”** and **“Anatomy of a Solana App”** sessions connected product thinking with the underlying technology. **Danh Đoàn, representing DUT Superteam University Club**, and **Thái Phạm Ngọc Tường of Corelia Academy** introduced how a Solana application comes together and how its different components combine to create a complete experience.

Through accessible examples, students gained a clearer view of the relationship among an idea, its user flow, and on-chain infrastructure. A product should not begin by attempting to put every feature on a blockchain. The team needs to understand its core value, decide which elements benefit from being on-chain, and design an experience that users can navigate with confidence.

## A direct conversation with the builder community

![UniHackFest Da Nang Campus 2026: From Market Opportunities to Product Ideas](/blog/corelia-unihackfest-da-nang-campus-2026/IMG_1970.jpg)

The **Open Q&A: From Idea to Building on Solana** brought MEXC Ventures, DUT Superteam University Club, and Corelia Academy together to respond directly to student questions. The discussion ranged from market opportunities and idea development to the first steps involved in building on Solana.

Beyond the stage sessions, networking gave students time to meet speakers, mentors, and peers with shared interests. It also created opportunities to find collaborators with complementary skills, discuss possible directions for their ideas, and connect more deeply with Da Nang's technology community.

## From one workshop to a longer building journey

![UniHackFest Da Nang Campus 2026: From Market Opportunities to Product Ideas](/blog/corelia-unihackfest-da-nang-campus-2026/IMG_1745.jpg)

UniHackFest Da Nang Campus 2026 concluded with strong energy and many ideas taking shape during the afternoon. More importantly, the program demonstrated that students do not need to wait until they know everything before beginning. A meaningful problem, a willingness to learn, and a team prepared to experiment are already a solid foundation for a first step.

Corelia Academy appreciates the collaboration of BTEC FPT, DUT Superteam University Club, GALAXY Communications & Events, and FIC – Financial Investing Club. We also thank MEXC Ventures and Solana Foundation for supporting an event that brought practical learning and product-building opportunities closer to students in Da Nang.

The UniHackFest journey will continue connecting young builders with the knowledge, mentorship, and ecosystem they need to move promising ideas closer to working products.
$md$),
('en', 'corelia-unihackfest-hutech-from-ideas-to-working-product-2026', 'corelia-unihackfest-hutech-from-ideas-to-working-product-2026', 'blog', 'published', $md$Corelia Academy, UniHackFest, and HUTECH Turn Ideas Into Working Products$md$, $md$On August 5, 2026, Corelia Academy joined UniHackFest and HUTECH for From Ideas to Working Product, connecting Digital Assets, Solana, AI, and Mini Ideation for students.$md$, 'corelia-team', 'announcements-events', ARRAY['web3','dapp-development','ecosystem','mentorship','project-based','hackathon']::text[], '{"type":"image","src":"/blog/corelia-unihackfest-hutech-from-ideas-to-working-product-2026/73A09668-1.jpg","alt":"Corelia Academy, UniHackFest, and HUTECH host the From Ideas to Working Product workshop","fit":"cover"}'::jsonb, '2026-08-05'::date, '2026-08-05'::timestamptz, '2026-08-05'::timestamptz, $md$On the morning of **August 5, 2026**, **Corelia Academy** joined the **UniHackFest 2026** Organizing Committee and **HUTECH** to bring the **“From Ideas to Working Product”** workshop to HUTECH Thu Duc Campus. Combining expert perspectives with Mini Ideation, the program introduced students to a product journey that begins with choosing a problem, defining its users, and building a working demo that can be presented and tested.

Supported by **MEXC Ventures** and **Solana**, the workshop connected Digital Assets, Web3, AI, and blockchain infrastructure with practical product thinking. Students from every field could take part, including those without Web3 experience, an existing idea, or a complete team.

## Bringing the Learn-to-Build Journey to HUTECH

![Corelia Academy, UniHackFest, and HUTECH turn ideas into working products](/blog/corelia-unihackfest-hutech-from-ideas-to-working-product-2026/73A09536-1.jpg)

During the UniHackFest 2026 introduction, **Thái Phạm Ngọc Tường, Founder of Corelia Academy**, presented the program roadmap, two competition tracks, four product themes, and opportunities for HUTECH students.

The **Best Product & Business** and **Best Technical Build** tracks allow teams to lead with different strengths. A meaningful product needs solid implementation, but it also depends on understanding the problem, identifying users, designing the experience, and communicating value.

The four themes: **RWA & Tokenization**, **Consumer dApps**, **DeFi & Digital Assets**, and **AI × Web3**: offer several entry points. Technology students can focus on implementation, while participants with backgrounds in finance, business, design, or communication can contribute vital perspectives on markets, users, and products.

This reflects Corelia Academy's approach to builder education: knowledge becomes valuable when learners apply it to create, test, and improve a solution.

## Connecting the Digital Asset Market to Product Problems

![Students explore product ideas during the workshop at HUTECH](/blog/corelia-unihackfest-hutech-from-ideas-to-working-product-2026/73A09536-1.jpg)

![The Digital Asset Market and Mini Ideation session at HUTECH](/blog/corelia-unihackfest-hutech-from-ideas-to-working-product-2026/73A09567.jpg)

The **Digital Asset Market & Opportunities for Student Builders** session introduced the broader digital asset landscape and possible opportunities for young product builders.

Rather than ending with market trends, the session led into Mini Ideation. Students brainstormed in groups, selected a problem, identified target users, and outlined an initial concept. Selected groups had an opportunity to present their thinking and receive direct feedback from the speakers and Organizing Committee.

The process encouraged students to move from asking “Which technology is trending?” to a more useful product question: “What problem does the user face, and where can a product create value?” That shift gives a technology idea a stronger foundation for further development.

## Building on Solana: Creating Something That Works

![Building on Solana session at the UniHackFest HUTECH workshop](/blog/corelia-unihackfest-hutech-from-ideas-to-working-product-2026/73A09658.jpg)

The **“Building on Solana: From Idea to Working Product”** session explored opportunities to build on Solana, how to choose an appropriate problem, and what a practical working demo should include.

An early-stage product does not need every possible feature. A team needs to isolate its core value, create a clear user flow, and implement enough functionality to test its assumptions. Once the demo works and can be presented, the team has something concrete from which to collect feedback and decide what to build next.

This perspective aligns with Corelia Academy's project-based learning model: study technology in the context of a real problem, produce a tangible outcome, and improve the product through repeated testing.

## AI and a New Advantage for Young Builders

![Cris D. Tran shares perspectives on AI with HUTECH students](/blog/corelia-unihackfest-hutech-from-ideas-to-working-product-2026/73A09638.jpg)

In **“AI: A Formidable Competitor or a Powerful Assistant for Young People?”**, **Cris D. Trần of Open Campus** shared perspectives on how AI affects education, careers, and the future of young people.

AI can help students research faster, improve productivity, develop skills, and accelerate creative work. Sustainable advantage, however, still comes from understanding the problem, asking strong questions, evaluating results, and making sound decisions. Used well, AI becomes a copilot that helps small teams experiment faster and devote more attention to users and product value.

## Connecting HUTECH with the Builder Ecosystem

![HUTECH students connect with the UniHackFest builder ecosystem](/blog/corelia-unihackfest-hutech-from-ideas-to-working-product-2026/73A09634-1.jpg)

Alongside the main sessions, networking gave students an opportunity to meet the Organizing Committee, guests, and peers with complementary skills. These conversations are especially valuable for students without a team, helping them find collaborators and understand the role they could play in a multidisciplinary group.

The HUTECH workshop demonstrated that product building can begin on campus. From an initial brainstorming session, students can continue refining the problem, choose a competition track, develop a working demo, and move further along the UniHackFest 2026 journey.

Corelia Academy appreciates the collaboration of HUTECH and the UniHackFest 2026 Organizing Committee, as well as the partners supporting practical learning and product-building opportunities for students. We will continue connecting education, mentorship, and the technology ecosystem so that young builders can turn promising ideas into valuable products.

![A memorable moment from the UniHackFest and HUTECH workshop](/blog/corelia-unihackfest-hutech-from-ideas-to-working-product-2026/73A09515-1.jpg)

**Explore the UniHackFest 2026 journey at [unihackfest.vn](https://unihackfest.vn/?utm_source=corelia_blog&utm_medium=content&utm_campaign=unihackfest_2026&utm_content=hutech_workshop_recap_en).**
$md$),
('en', 'corelia-unihackfest-unitour-van-hien-solana-2026', 'corelia-unihackfest-unitour-van-hien-solana-2026', 'blog', 'published', $md$Corelia Academy and UniHackFest Connect Van Hien Students with the Solana Ecosystem$md$, $md$On August 14, 2026, Corelia Academy and UniHackFest brought Chaerin Kim from the Solana Foundation to Van Hien University in person, connecting Mini Ideation with a Solana product roadmap.$md$, 'corelia-team', 'announcements-events', ARRAY['web3','blockchain-fundamentals','dapp-development','ecosystem','mentorship','hackathon']::text[], '{"type":"image","src":"/blog/corelia-unihackfest-unitour-van-hien-solana-2026/_DSC3911.jpg","alt":"Corelia Academy connects Chaerin Kim and the Solana Foundation with Van Hien University students","fit":"cover"}'::jsonb, '2026-08-14'::date, '2026-08-14'::timestamptz, '2026-08-14'::timestamptz, $md$On the morning of **August 14, 2026**, **Corelia Academy** and the **UniHackFest 2026** Organizing Committee joined **Van Hien University** to host UniHackFest UniTour at HungHau Campus. The workshop connected market perspectives from MEXC Ventures with technical direction from the Solana Foundation, helping students move from an early idea toward a project and working demo.

A defining highlight was the in-person presence of **Chaerin Kim, Developer Relations at the Solana Foundation**, in Vietnam. Unlike her remote participation from South Korea during the UEF Kick-off, this visit brought her Solana ecosystem perspectives directly to young builders on campus at Van Hien University.

## Connecting the Student Builder Journey at Van Hien University

![Corelia Academy and UniHackFest connect Van Hien students with the Solana ecosystem](/blog/corelia-unihackfest-unitour-van-hien-solana-2026/_DSC3571-1.jpg)

During the UniHackFest 2026 introduction, **Thái Phạm Ngọc Tường (Terran Thai), Founder of Corelia Academy**, presented the program, competition themes, learning tracks, and journey from an idea to a working demo.

A product does not begin with choosing the most complex technology. A team needs to understand the problem, identify users, clarify the value, and select a small enough scope to test. A working demo turns assumptions into a tangible experience from which the team can collect feedback and improve.

This reflects Corelia Academy's project-based learning approach: technical knowledge should connect with product thinking, research, and collaboration. Students can begin with their current strengths and expand their capabilities through the building process.

## MEXC Ventures: From the Digital Asset Market to Mini Ideation

![Theon from MEXC Ventures shares digital asset market perspectives](/blog/corelia-unihackfest-unitour-van-hien-solana-2026/_DSC3620.jpg)

![Van Hien students participate in the Mini Ideation Workshop](/blog/corelia-unihackfest-unitour-van-hien-solana-2026/_DSC3626.jpg)

![Student teams brainstorm product ideas at UniHackFest UniTour Van Hien](/blog/corelia-unihackfest-unitour-van-hien-solana-2026/_DSC3876.jpg)

**Theon, Brand Manager at MEXC Ventures**, led **Digital Asset Market & Opportunities for Student Builders**, connecting the digital asset market with potential product problems for students to explore.

During the Mini Ideation Workshop, students brainstormed in groups and shaped initial product directions. Rather than beginning with a predetermined solution, the process encouraged learners to examine the market, identify a problem, and define a user group with a clear need.

The investment and market perspective showed students that a technical idea needs a real-world context. A product should explain the value it creates, who will use it, and why the selected technology is more appropriate than existing approaches.

## Chaerin Kim in Vietnam: Opening a Door to the Solana Ecosystem

![Chaerin Kim from the Solana Foundation speaks in person at Van Hien University](/blog/corelia-unihackfest-unitour-van-hien-solana-2026/_DSC3696.jpg)

![Chaerin Kim introduces what students can build on Solana](/blog/corelia-unihackfest-unitour-van-hien-solana-2026/_DSC3684.jpg)

In **“Building on Solana: What Can You Build?”**, **Chaerin Kim** introduced the foundational components of a Solana product: a **wallet, token, payment, program or smart contract, on-chain data**, and frontend.

From these building blocks, students can imagine a variety of products, including payment applications, loyalty or reward systems, marketplaces, DeFi products, consumer apps, and solutions combining **AI × blockchain**.

Chaerin Kim's in-person presence in Vietnam carried significance beyond a technical presentation. Students had a closer point of contact with a representative of the Solana Foundation and could see a path connecting a Vietnamese campus with an international builder ecosystem.

The session also helped learners avoid the instinct to add blockchain to every product. A solution should use Solana when the problem genuinely requires transactions, ownership, verifiable data, or on-chain logic. Once the technical reason is clear, a team can design a more focused and convincing demo.

For Corelia Academy, direct connections such as Chaerin Kim's visit are an important part of bringing international resources closer to students. Young builders can learn not only from documentation but also from people actively developing and supporting the ecosystem.

## Phạm Minh Tuấn: A Roadmap to a First Solana Project

Next, **Phạm Minh Tuấn, External Developer Advocate at the Solana Foundation**, presented **“From Idea to Solana Project: How to Start.”**

The roadmap begins with the problem and users, then determines which part genuinely needs blockchain. The team chooses suitable Solana functionality, builds a prototype, connects a wallet, brings a transaction on-chain, and completes a working demo.

Breaking the journey into steps makes a project more approachable for students. Instead of attempting a complete system, a team can focus on one core flow, test the most important integration, and expand after receiving feedback.

Together, Chaerin Kim and Phạm Minh Tuấn gave students both sides of the journey: what can be built and how to begin building it. This is the bridge between technology inspiration and product action.

## Connecting the University, Ecosystem, and a New Builder Generation

![Van Hien students join the Q&A with sponsors, mentors, and organizers](/blog/corelia-unihackfest-unitour-van-hien-solana-2026/_DSC3739-1.jpg)

The Q&A with sponsors, mentors, and the Organizing Committee gave students an opportunity to ask about the program, Solana, competition themes, team formation, and first steps in product development.

The Van Hien UniTour demonstrated the value of connecting a university, education provider, investment organization, and technology ecosystem. Students encountered several perspectives within one journey: market context, ideation, product thinking, and implementation.

Corelia Academy appreciates the collaboration of Van Hien University, the UniHackFest 2026 Organizing Committee, MEXC Ventures, and the Solana Foundation. In particular, Chaerin Kim's in-person presence in Vietnam created a meaningful point of connection between Van Hien students and the global Solana builder community.

![A memorable moment from UniHackFest UniTour at Van Hien University](/blog/corelia-unihackfest-unitour-van-hien-solana-2026/_DSC3855-1.jpg)

![Speakers, organizers, and students at UniHackFest UniTour Van Hien](/blog/corelia-unihackfest-unitour-van-hien-solana-2026/_DSC3585.jpg)

**Explore the UniHackFest 2026 journey at [unihackfest.vn](https://unihackfest.vn/?utm_source=corelia_blog&utm_medium=content&utm_campaign=unihackfest_2026&utm_content=van_hien_solana_unitour_recap_en).**
$md$),
('en', 'corelia-unihackfest-unitour-van-lang-2026', 'corelia-unihackfest-unitour-van-lang-2026', 'blog', 'published', $md$Corelia Academy and UniHackFest UniTour Inspire Student Builders at Van Lang University$md$, $md$On July 11, 2026, UniHackFest UniTour arrived at Van Lang University, connecting students with AI, Web3, Blockchain, Digital Assets, and hands-on product ideation.$md$, 'corelia-team', 'announcements-events', ARRAY['web3','blockchain-fundamentals','ecosystem','mentorship','project-based','hackathon']::text[], '{"type":"image","src":"/blog/corelia-unihackfest-unitour-van-lang-2026/_DSC2776.jpg","alt":"Corelia Academy and UniHackFest UniTour at Van Lang University","fit":"cover"}'::jsonb, '2026-07-11'::date, '2026-07-11'::timestamptz, '2026-07-11'::timestamptz, $md$On the afternoon of **July 11, 2026**, the **Faculty of Information Technology at Van Lang University** collaborated with the **UniHackFest 2026 Organizing Committee** to host **UniHackFest UniTour**. This new stop on the UniTour journey gave students a space to explore technology trends, engage directly with experts, and practice developing product ideas.

With contributions from experts representing **Corelia Academy, MEXC Ventures**, and the **Solana Foundation**, the program connected knowledge of **AI, Web3, Blockchain**, and **Digital Assets** with practical problem-solving. It also helped Van Lang students better understand the journey of becoming **student builders**: learning technology while forming teams, validating ideas, and gradually turning solutions into products.

![Corelia Academy and UniHackFest UniTour Inspire Student Builders at Van Lang University](/blog/corelia-unihackfest-unitour-van-lang-2026/_DSC2307.jpg)

## Bringing the Student Builder Journey to Van Lang University

During UniTour, students received an overview of **UniHackFest 2026**, its competition themes, learning roadmap, and development opportunities throughout the program. Rather than treating the competition as an isolated destination, the journey is designed for participants to learn, practice, and strengthen their product-building capabilities at each stage.

For students just getting started, this overview clarified how different strengths can contribute to a team. A technology product brings together engineering, experience design, market understanding, communication, and the ability to articulate value. Each student can begin with their current strengths and develop the other skills they need as the program progresses.

![Corelia Academy and UniHackFest UniTour Inspire Student Builders at Van Lang University](/blog/corelia-unihackfest-unitour-van-lang-2026/_DSC2418.jpg)

## Practical Perspectives on AI, Web3, and Digital Assets

The sessions from representatives of **Corelia Academy, MEXC Ventures**, and the **Solana Foundation** brought students closer to fields shaping digital transformation: AI, Web3, Blockchain, and Digital Assets.

These topics were connected to a larger question rather than presented as isolated technology terms: what problems can young people solve with technology, and how can they create value? Perspectives from education, the market, and the broader ecosystem encouraged students to move beyond learning individual tools and consider users, application contexts, and a product's potential to grow.

For Corelia Academy, this is a central part of builder education. Technical foundations need to be paired with product thinking, collaboration, and a willingness to experiment. By encountering practical perspectives directly on campus, students gain a stronger basis for choosing a path and turning knowledge into tangible outcomes.

![Corelia Academy and UniHackFest UniTour Inspire Student Builders at Van Lang University](/blog/corelia-unihackfest-unitour-van-lang-2026/_DSC2437.jpg)

## Mini Ideation Workshop: From Problems to Product Ideas

The **Mini Ideation Workshop** was a highlight of the program. Students worked together to discuss real-world challenges and develop ideas to address them. The activity moved participants from listening to doing: observing a problem, proposing a solution, dividing responsibilities, and preparing a presentation.

The ideation process let teams practice foundational product questions: what problem needs to be solved, who experiences it, what value the solution provides, and what first step could validate the idea. Teams then presented their work and received feedback from experts, mentors, and the Organizing Committee.

Direct feedback helped students recognize the strengths, gaps, and possible improvements in their ideas. More importantly, the workshop demonstrated that building a product does not begin with an oversized solution. It begins with understanding the problem and being willing to adjust based on feedback.

![Corelia Academy and UniHackFest UniTour Inspire Student Builders at Van Lang University](/blog/corelia-unihackfest-unitour-van-lang-2026/_DSC2500.jpg)

![Corelia Academy and UniHackFest UniTour Inspire Student Builders at Van Lang University](/blog/corelia-unihackfest-unitour-van-lang-2026/_DSC2471.jpg)

![Corelia Academy and UniHackFest UniTour Inspire Student Builders at Van Lang University](/blog/corelia-unihackfest-unitour-van-lang-2026/_DSC2480.jpg)

## Connecting the University, Experts, and the Technology Ecosystem

Alongside the talks and workshop, students engaged directly with speakers and guests through questions and conversation. These exchanges helped them clarify technology concepts, understand the product development process, and learn how to prepare for UniHackFest 2026.

The event also created a connection between the university, education providers, businesses, and the technology ecosystem. Students encountered multiple perspectives, experts heard directly from the next generation of builders, and the university expanded its learning environment through practical experiences.

Through these connections, students gained more than updated technology knowledge. They also practiced teamwork, innovation, presentation, and the proactive mindset required to develop products.

![Corelia Academy and UniHackFest UniTour Inspire Student Builders at Van Lang University](/blog/corelia-unihackfest-unitour-van-lang-2026/_DSC2638.jpg)

## From One UniTour to a Long-Term Building Journey

The Van Lang University stop concluded with the hope that more teams from the university will confidently join UniHackFest 2026. Students can build on the ideas formed during the workshop by finding teammates, selecting a problem to pursue, and preparing for the program's next stages.

Corelia Academy appreciates the collaboration of the Faculty of Information Technology at Van Lang University, the Organizing Committee, partners, experts, and every participating student. We will continue helping bring practical knowledge, product thinking, and technology-building opportunities closer to student communities.

![Corelia Academy and UniHackFest UniTour Inspire Student Builders at Van Lang University](/blog/corelia-unihackfest-unitour-van-lang-2026/_DSC2512.jpg)

**Explore the journey and register at [unihackfest.vn](https://unihackfest.vn/?utm_source=corelia_blog&utm_medium=content&utm_campaign=unihackfest_2026&utm_content=van_lang_unitour_recap).**
$md$),
('en', 'corelia-vibe-coding-day-hcmact-ai-product-2026', 'corelia-vibe-coding-day-hcmact-ai-product-2026', 'blog', 'published', $md$Corelia Academy, HCMACT, and GDG Cloud HCMC Host Vibe Coding Day$md$, $md$On August 12, 2026, Corelia Academy and UniHackFest joined HCMACT and GDG Cloud HCMC for Vibe Coding Day, helping students build AI applications through hands-on practice.$md$, 'corelia-team', 'announcements-events', ARRAY['tooling','project-based','mentorship','ecosystem','hackathon','career-tips']::text[], '{"type":"image","src":"/blog/corelia-vibe-coding-day-hcmact-ai-product-2026/DSC01418-1.jpg","alt":"Corelia Academy joins HCMACT and GDG Cloud HCMC for Vibe Coding Day in Campus","fit":"cover"}'::jsonb, '2026-08-12'::date, '2026-08-12'::timestamptz, '2026-08-12'::timestamptz, $md$On the afternoon of **August 12, 2026**, **Corelia Academy** and **UniHackFest** joined the **Academy of Cryptography Techniques, Ho Chi Minh City Campus (HCMACT)** and **Google Developer Groups Cloud Ho Chi Minh City (GDG Cloud HCMC)** to host **Vibe Coding Day in Campus**. **Sumit Chandel, Developer Relations Engineer at Google**, directly guided students through the Build with Google AI session, from preparing their environment to generating code, running a demo, and refining the product.

With their backgrounds in Information Security and Software Engineering, HCMACT students are well positioned to explore how AI can accelerate development while retaining sound engineering, testing, and security practices. The approach also reflects Corelia Academy's project-based learning model: knowledge should become an output that can run, be tested, and continue to improve.

## Vibe Coding: Accelerating Development Without Replacing Judgment

![Corelia Academy, HCMACT, and GDG Cloud HCMC host Vibe Coding Day](/blog/corelia-vibe-coding-day-hcmact-ai-product-2026/DSC01229.jpg)

Vibe coding allows builders to describe features in natural language and use AI to help generate or revise code. With a lower barrier to getting started, students can devote more attention to the problem, users, and product flow.

Speed does not eliminate the need for solid foundations. AI-generated code can still contain defects, miss edge cases, or introduce security risks. Developers need to read and understand its structure, run tests, examine data handling, validate inputs, and determine whether the result matches the original objective.

For Corelia Academy, AI is one tool within a builder's workflow. It enables faster experimentation, but the builder remains responsible for technical decisions and product quality.

## Bringing the UniHackFest UniTour Journey to HCMACT

![Introducing the UniHackFest 2026 journey to HCMACT students](/blog/corelia-vibe-coding-day-hcmact-ai-product-2026/DSC01150.jpg)

The program introduced **UniHackFest 2026**, its **Best Product & Business** and **Best Technical Build** tracks, and four product themes: **RWA & Tokenization**, **Consumer dApps**, **DeFi & Digital Assets**, and **AI × Web3**.

The UniTour session showed students what can follow the workshop. A small application built during the afternoon can become a prototype that a team continues to develop through user research, clearer product value, and stronger implementation.

HCMACT students bring more than software development skills. Their information security perspective can help teams ask better questions about data, access control, system risks, and ways to build trustworthy products from an early stage.

## Build with Google AI: Learning by Building

![Sumit Chandel guides HCMACT students during Build with Google AI](/blog/corelia-vibe-coding-day-hcmact-ai-product-2026/DSC01441-1.jpg)

**GDG Cloud HCMC** introduced the **Build with Google AI** approach and led the hands-on session, with **Sumit Chandel, Developer Relations Engineer at Google**, serving as the main instructor.

Sumit Chandel guided students through building their first AI application on their laptops, from preparing the environment and describing a feature to generating code, running the application, and refining the result. Direct guidance from a developer relations specialist gave participants a structured way to approach the tools and understand how to communicate requirements effectively to AI.

The exercise connected steps that are often separated in theoretical learning: define a requirement, describe a feature, generate code, run the application, and address unexpected results. Sumit Chandel and the mentor team helped participants work through obstacles, while each student remained responsible for operating the tools and observing the product take shape.

Once an application runs, learners have a concrete foundation for deeper questions: which flow needs improvement, which feature is truly necessary, how data is handled, and what must be tested before the product reaches users.

## Build Sprint: From a Sample Application to an Original Idea

![HCMACT students build AI applications during the Build Sprint](/blog/corelia-vibe-coding-day-hcmact-ai-product-2026/DSC01543.jpg)

During the **Build Sprint**, students could extend the sample application or begin developing an idea of their own with mentors available on site.

The session encouraged participants to choose a small enough scope to complete and test. Instead of attempting every feature, a team needs to identify its most important flow, clarify the core value, and produce a demo that can be presented.

This is a compact version of iterative product development: build, run, receive feedback, and refine. When AI shortens implementation time, teams can complete more learning cycles, provided that they retain control over quality and understand what they are adding to the product.

## Showcasing and Connecting Builder Teams

![Students present their AI demos at Vibe Coding Day](/blog/corelia-vibe-coding-day-hcmact-ai-product-2026/DSC01768.jpg)

![A product showcase during Vibe Coding Day at HCMACT](/blog/corelia-vibe-coding-day-hcmact-ai-product-2026/DSC01820.jpg)

![Student builders share the applications they developed during the workshop](/blog/corelia-vibe-coding-day-hcmact-ai-product-2026/DSC01723.jpg)

The showcase gave selected students or teams space to introduce the demos they had developed. Presenting an early-stage product helps learners practice describing the problem, explaining their decisions, and receiving feedback.

The program also created team-building opportunities for UniHackFest. Students with strengths in engineering, security, product, design, or research could meet peers whose capabilities complement their own and continue developing ideas after the event.

From Vibe Coding Day, students can join UniHackFest through a flexible journey, learn with online resources, form teams, choose themes, develop demos, and work toward Demo Day. Standout projects may also access mentoring, communications support, partner connections, and incubation activities.

Corelia Academy appreciates HCMACT for hosting the event and GDG Cloud HCMC for collaborating on a practical learning experience for students. We will continue connecting knowledge, tools, and the wider ecosystem so that young builders can move from ideas to working products.

![Speakers, mentors, and students at Vibe Coding Day in Campus](/blog/corelia-vibe-coding-day-hcmact-ai-product-2026/DSC01371.jpg)

**Explore the UniHackFest 2026 journey at [unihackfest.vn](https://unihackfest.vn/?utm_source=corelia_blog&utm_medium=content&utm_campaign=unihackfest_2026&utm_content=vibe_coding_day_hcmact_recap_en).**

*GDG Cloud HCMC is an independent community. Activities and views presented at the event do not represent Google.*
$md$),
('en', 'insted-2026-corelia-academy', 'insted-2026-corelia-academy', 'blog', 'published', $md$Corelia Academy at INSTED 2026: A Strategic Step for Web3 Education in Vietnam$md$, $md$On March 5, 2026 at SIHUB (HCMC), Corelia Academy joined INSTED's New Year Gathering – AI & Blockchain Education, sharing the Web3 Product Builder vision and signing a strategic MOU.$md$, 'terran', 'career-ecosystem-insights', ARRAY['web3','blockchain-fundamentals','ecosystem','project-based','mentorship','career-tips']::text[], '{"type":"image","src":"/blog/DSC08750.JPG","alt":"Corelia Academy at INSTED 2026 - AI & Blockchain Education event, SIHUB Ho Chi Minh City","ogSrc":"/blog/og/DSC08750.JPG"}'::jsonb, '2026-03-05'::date, '2026-03-05'::timestamptz, '2026-03-05'::timestamptz, $md$On the morning of March 5, 2026, at the SIHUB innovation space (Ho Chi Minh City), Corelia Academy was honored to take part and make a strong impression at the "New Year Gathering 2026 – AI & Blockchain Education" event organized by the Institute for the Development of Science, Technology and Education (INSTED). This was not just a routine networking event, but a milestone affirming Corelia's commitment to bringing hands-on Web3 education closer to the formal education system.

You can learn more about the organization on the [official INSTED website](https://insted.edu.vn/).

The digital era is witnessing the rapid rise of AI and Blockchain. However, the Vietnamese market still faces a major challenge: a severe shortage of talent with system-architecture thinking and the ability to build real products (Product Builders). Aware of this, Corelia Academy brought strategic solutions to INSTED 2026 through two core activities.

## 1. Sharing the Vision of "Building the Next Generation of Web3 Product Builders" on the Main Stage

![](/blog/z7594455824388_000612a7f194f5f8fdd36e35ceb6e3f9.jpg)

At the event's strategic dialogue session, Corelia Academy's representative gave a presentation that shared a full picture of the current IT workforce and the academy's breakthrough training approach.

Rather than only training "code workers", Corelia emphasized its core philosophy: **"Digital Assets First – Technology Follows"**. We brought to the event a clear message about the Three-Pillar Ecosystem that the academy runs:

- **For Learners:** Building a full picture of DeFi, Tokenomics, and Web3 business models before going deep into programming through a 3–6 month "Web3 Semester".

- **For Universities:** Acting as an industry bridge with a "Zero-Burden" approach, supporting institutions to integrate academic credit and co-organize Hackathons and Bootcamps on campus.

- **For Enterprises (B2B Solutions):** Addressing the demand for high-quality talent through a Talent Placement network and a "Squad-as-a-Service" model.

The response from experts, university representatives (such as Bach Khoa, Ton Duc Thang, Gia Dinh, Van Lang) and businesses present at the event confirmed that Corelia's project-based learning model aligns with the market's pressing needs.

## 2. Strategic MOU Signing with INSTED: Expanding the EdTech Ecosystem

![](/blog/20260305_102931.jpg)

The highlight of Corelia's presence at the event was the **Memorandum of Understanding (MOU)** signing ceremony with INSTED.

INSTED is a pioneer in building UNESCO-aligned AI & Blockchain competency frameworks for students and in applying blockchain technology to digital copyright verification. Corelia Academy becoming a strategic partner of INSTED brings strong synergies:

- **Expertise alignment:** Corelia's technical foundation and hands-on curricula from major ecosystems (such as Sui, Move) will complement INSTED's goal of developing high-quality human resources.

- **Broader reach:** This partnership opens the door for Corelia's training programs to reach deeper into the network of universities, colleges, and government bodies.

## Toward a Breakthrough 2026

"AI creates new capability, Blockchain creates digital trust." The combination of traditional education and decentralized technology is reshaping the future of the creative economy.

The New Year event with INSTED closed with promising handshakes and set the stage for a busy but exciting 2026 for the Corelia Academy team. We are committed to continuing to refine our ecosystem and to accompany young developers on their journey to becoming globally sought-after Web3 professionals.
$md$),
('en', 'insted-2026-product-builder-talk', 'insted-2026-product-builder-talk', 'blog', 'published', $md$Don't Just Be a "Code Worker" – Shaping Foundational Thinking for Web3 Developers (INSTED 2026)$md$, $md$Corelia Academy Founder's talk at INSTED 2026: Vietnam IT workforce reality, the "Digital Assets First – Technology Follows" philosophy, and the path to becoming a Web3 Product Builder.$md$, 'terran', 'career-ecosystem-insights', ARRAY['web3','blockchain-fundamentals','ecosystem','project-based','mentorship','career-tips']::text[], '{"type":"youtube","url":"https://www.youtube.com/watch?v=zmpaw0_LCYY"}'::jsonb, '2026-03-05'::date, '2026-03-05'::timestamptz, '2026-03-05'::timestamptz, $md$On the morning of March 5, 2026, at the New Year Gathering organized by the Institute for the Development of Science, Technology and Education (INSTED), Terran – Founder of Corelia Academy – delivered a strategic presentation on the state of Vietnam's IT workforce and the vision of building the next generation of Web3 Product Builders.

**The video at the top is the full presentation (~10 minutes).** If you're a developer or IT student looking to step into the Web3 era, these 10 minutes are worth your time.

## The Paradox of Vietnam's IT Market: Crowded Yet "Thirsty"

At the start of the talk, Founder Terran outlined a telling picture of the market [00:46]:

- Digital asset capital flowing into Vietnam reached **US$120 billion/year** (2025 data).
- Nearly **20 million people** (20% of the population) hold digital assets.
- Vietnam has a large IT engineering workforce of over **560,000 people**.

Yet the supply of talent for Web3 remains very limited. Most developers today lack a solid understanding of the digital asset market, decentralized finance (DeFi), and the structure of a Web3 product. This leads to what Corelia calls **"Code Worker Syndrome"** [02:13] – people who only take requirements and type commands without understanding what problem the product they're building actually solves. In an era when AI can write code in 15 minutes, passive "code workers" are at high risk of being left behind.

## A Breakthrough Training Philosophy: "Digital Assets First, Technology Follows"

To address this, Corelia Academy offers a different training philosophy [02:38]: **Digital assets must come first, technology follows.**

We believe that understanding *why* we use Blockchain and how the decentralized economy works matters more than learning how to write Blockchain. Corelia's curriculum is designed to build a **Helicopter View** [04:05] before diving into deep technical work, so learners understand the roots of the technology, market history, and how to design business models that create value.

## Corelia Academy's Three-Pillar Ecosystem

Beyond standalone courses, Corelia runs a closed-loop education ecosystem connecting three key groups:

1. **Learners:** Project-based learning. Learners work in Product Teams (Dev, Product Manager, PD, etc.) to build real products and solve real problems.

2. **Universities:** Corelia acts as an "Industry Bridge." The academy has partnered with more than 10 major universities (e.g. Van Lang, Van Hien, University of Industry and Trade, Gia Dinh) [04:45] to run Web3 Learning Tours and two-week Bootcamps. We support institutions with a **"Zero-Burden"** approach, bringing real-world project environments from global initiatives straight to campus.

3. **Enterprises (B2B Solutions):** Talent Placement from vetted graduates. Corelia also introduces **Squad-as-a-Service** [08:02] – a full "squad" specialized in Blockchain – helping Web2 companies transition to Web3 quickly and cost-effectively.

## 2026 Direction: UniFest and UEF

To close the presentation, Founder Terran shared Corelia's biggest plan for 2026: **UniFest 2026** [08:48]. A strategic partnership with the University of Economics – Finance (UEF), one of the most open and forward-looking institutions on digital assets. UniFest is set to connect a network of more than 10 universities and attract over 2,000 students, becoming a launchpad for the next generation of Web3 Builders.

---

**It's time to level up from "Coder" to "Web3 Product Builder".**

- Learn more about our model and training roadmap in the **Whitepaper:** [Download Corelia Academy Whitepaper](https://corelia.academy/CoreliaAcademy_VI.pdf) [09:40].
- Ready to get hands-on? **[Contact us](/contact)** today!
$md$),
('en', 'move-bootcamp-on-campus-1-viet-my-college', 'move-bootcamp-on-campus-1-viet-my-college', 'blog', 'published', $md$Recap: Move Bootcamp on Campus #1: Launching the Sui Journey at Viet My College$md$, $md$Recap of Move Bootcamp on Campus #1 at Viet My College (Nov 14, 2025): from DLT, Blockchain, and Smart Contract fundamentals to hands-on Sui CLI, Sui Wallet, and Mini quiz, with speakers from Sui Foundation and First Movers Vietnam.$md$, 'terran', 'career-ecosystem-insights', ARRAY['web3','blockchain-fundamentals','move-language','tooling','ecosystem','career-tips']::text[], '{"type":"image","src":"/blog/NVA04774.JPG","alt":"Move Bootcamp on Campus #1 - Viet My College, Trung Son Campus","ogSrc":"/blog/og/NVA04774.JPG"}'::jsonb, '2025-11-14'::date, '2025-11-14'::timestamptz, '2025-11-14'::timestamptz, $md$On the morning of November 14, 2025, the Sui Learning Tour officially landed at Viet My College (Trung Son Campus, Binh Chanh) for "Move Bootcamp on Campus #1". With nearly 100 students and young developers in attendance, the event was an energetic kickoff for the "Sui & Move Bootcamp" training series in Vietnam.

## 1. Building the Foundation: First Steps Into the Web3 World

![Move Bootcamp on Campus #1 - Opening at Viet My College, Trung Son Campus](/blog/NVA04544.JPG)

Unlike typical seminars, Move Bootcamp on Campus #1 was designed as a foundation class, taking students from the core concepts of Distributed Ledger Technology (DLT) and Blockchain to how Smart Contracts and decentralized applications (DApps) work.

Participants got a clear look at the Sui ecosystem’s breakthrough architecture: a next-generation blockchain known for parallel transaction processing and an optimized object-based data model.

## 2. Expert Speakers Every Step of the Way

![Speakers at Move Bootcamp on Campus #1 - Viet My College](/blog/NVA04498.JPG)

Throughout the 3-hour program, students were guided and inspired by a line-up of trusted speakers and experts from the ecosystem:

- **Thái Phạm Ngọc Tường**: Developer Ambassador, Sui Foundation & Founder, Purro Wallet
- **Trần Tiến Phát**: Developer Ambassador, Sui Foundation
- **Nguyễn Hà Phúc**: Developer Ambassador, Sui Foundation
- **Phan Hoàng Vinh Hiển**: Developer Relations, First Movers Vietnam

Thanks to the speakers’ hands-on guidance, complex tech concepts were explained in an intuitive, easy-to-follow way that resonated with students.

## 3. Hands-on Experience: Tooling Setup & On-chain Interaction

The standout part of Bootcamp #1 was the Hands-on Session. Beyond theory, students got to:

- **Set up** the Sui CLI toolchain and create a Sui Wallet.
- **Perform** their first interactions with the Sui Testnet.
- **Compete** in the "Hiểu nhanh về Sui" (Quick Sui Quiz) mini-game and win prizes from the organizers.

Participants also received a **Session Completion Certificate** and a ticket to the next phases of the Bootcamp: culminating in the Mini Hackathon Demo Day.

## 4. Closing

Move Bootcamp on Campus #1 at Viet My College wrapped up successfully, laying the first building blocks for the developers of tomorrow. The session helped students get past initial tooling barriers and get ready for what’s next: writing Move code and building real DApps.

A big thank you to Viet My College and all the students who made this launch so lively. Head home, review what you learned, keep the momentum, and get set for the tougher coding challenges in the upcoming Bootcamp sessions!
$md$),
('en', 'solana-developer-bootcamp-structured-builder-journey', 'solana-developer-bootcamp-structured-builder-journey', 'case-study', 'published', $md$Solana Developer Bootcamp: Turning a Complex Stack into a Structured Builder Journey$md$, $md$How Corelia transforms Solana's complex development stack into a progressive path from architecture and program logic to testing, deployment, and a working on-chain product.$md$, 'corelia-team', 'community-success-stories', ARRAY['web3','smart-contracts','dapp-development','mentorship','project-based','tooling']::text[], '{"type":"image","src":"/blog/corelia-unihackfest-unitour-van-hien-solana-2026/_DSC3696.jpg","alt":"Solana developer education session by Corelia Academy","fit":"cover"}'::jsonb, '2026-08-25'::date, '2026-08-25'::timestamptz, '2026-08-25'::timestamptz, $md$**Developer Education · Solana Ecosystem**

Learning Solana is not difficult because developers lack documentation. It is difficult because many concepts have to make sense together.

A developer needs to understand wallets, accounts, transactions, programs, tokens, PDAs, Anchor, testing, frontend integration, Devnet, deployment, and debugging before those individual pieces begin to feel like a complete development workflow.

Corelia Academy designed the Solana Developer Bootcamp to turn that complexity into a progressive learning journey. The objective is not to help learners memorize Solana terminology. It is to help them **build something that works**.

## The Challenge

Developer education commonly encounters two problems.

The first is **theory without execution**. Learners understand what a smart contract or account is, but struggle when asked to build, test, connect, and deploy an application themselves.

The second is **execution without understanding**. Learners follow tutorials, clone repositories, change a few lines of code, and produce something that runs without developing a reliable mental model of why it works.

Both approaches become painful when something breaks. A failed transaction, incorrect PDA, account constraint, wallet integration issue, or deployment error can quickly stop a learner who knows only the happy path.

Corelia's curriculum was designed around a different question: **What does a developer need to understand in order to build independently after the course is over?**

## The Corelia Approach

![Students exploring the Solana development stack](/blog/corelia-unihackfest-unitour-van-hien-solana-2026/_DSC3620.jpg)

The Bootcamp follows a build-first methodology while deliberately teaching the mental models behind the code. The sequence moves from:

**Foundation → Architecture → Program Logic → Testing → Application → Deployment**

Before working with larger applications, learners understand the Solana execution model. They learn the relationship between wallets and accounts, examine how transactions contain instructions, understand how programs interact with account state, and work with PDAs and permissions. Only then does the curriculum progressively increase product complexity.

The Solana Development track published for UniHackFest is one implementation of this architecture: a four-week technical path covering 10 modules and 40 lessons, supported by live technical sessions and mentor office hours. Topics progress from ecosystem and account fundamentals through transactions, tokens, programs, Anchor, frontend integration, Devnet, and a capstone.

## Learning by Building, Not by Watching

Corelia treats code as something learners should construct, question, test, and break. A typical learning loop follows:

**Concept → Schema → Code → Test**

First, learners understand the concept. Then the architecture becomes visible through account relationships, transaction flows, or program structure. Next, they implement the logic. Finally, they prove that the implementation behaves correctly.

This is especially important in blockchain development because the frontend is only one part of the system. A working product may require wallet interaction, program state, transaction construction, error handling, and verifiable on-chain activity to work together. Learners therefore progress from isolated exercises toward a complete application.

## From Fundamentals to Full-Stack Solana

### Understand the Solana Mental Model

Learners begin with the concepts that make Solana different from conventional application development: accounts, instructions, programs, transaction execution, wallets, fees, and on-chain state.

### Build Program Logic

With the mental model established, students move into Rust and Anchor-based program development. They reason about state, instructions, PDAs, signers, account constraints, and program interactions rather than treating smart contracts as a black box.

### Work with Digital Assets

Tokens and on-chain assets create practical contexts in which learners apply account models, permissions, transfers, and program-controlled state.

### Test What They Build

Testing is treated as part of development rather than an optional step before submission. Learners examine expected state transitions, failure cases, authorization boundaries, and transaction behavior.

### Connect the Frontend

Wallet integration, client-side transaction flows, account queries, error states, and Explorer verification connect blockchain development with a usable product experience.

### Deploy and Demonstrate

A technical learning journey becomes meaningful when another person can verify the result. Within UniHackFest, the Solana layer culminates in a Devnet dApp with wallet integration and transaction evidence visible through Explorer.

## A Curriculum Built Around Outputs

![Hands-on learning during a Corelia campus program](/blog/unihackfest-unitour-2-dhv-web3-solana-2026/IMG_3102.jpg)

One of the most important design decisions was to stop treating course completion as the primary result. Watching every lesson is not the same as being able to build.

Corelia therefore designs learning around outputs that can become evidence of capability:

- A working program.
- A tested transaction flow.
- A connected frontend.
- A deployed application.
- A public repository.
- A capstone or working demo.

These outputs are useful beyond the course. They can become part of a developer portfolio, form the technical foundation of a hackathon project, help mentors identify where a learner is struggling, and provide a more credible signal of technical ability than attendance alone.

## Connecting Developer Education to a Real Builder Pipeline

The Solana Bootcamp becomes more powerful when connected to an environment in which learners have a reason to use what they learn. That is why the curriculum also functions as the technical layer of UniHackFest.

Students do not learn Solana and then wonder what to do next. They take those skills into a product-building journey where they define a problem, form a team, build an application, receive feedback, qualify, and eventually demonstrate the product.

Within the UniHackFest model, Rust Survival Kit and Solana Bootcamp prepare teams to move from an idea toward wallet integration, verifiable transactions, and a working Solana application. This closes an important gap between **developer education** and **developer activation**.

## Corelia's Role

Corelia designed the experience across the full technical learning layer:

**Curriculum Design · Technical Education · Learning Content · Developer Experience · Project Architecture · Mentorship · Assessment · Capstone Design**

The work is not simply translating documentation into Vietnamese. It requires deciding what learners should understand first, which abstractions should be delayed, where hands-on exercises are necessary, how projects should increase in complexity, what evidence demonstrates real understanding, and how the curriculum connects to the next stage of the builder journey.

## Why This Case Matters

Great developer ecosystems need more than documentation. They need a path through the documentation.

The Solana Developer Bootcamp demonstrates Corelia's approach to developer education: translate a complex technical ecosystem into a sequence that learners can understand, practice, test, and eventually use independently.

The result is not simply another blockchain course. It is a reusable developer education system that can support online learning, university workshops, technical bootcamps, hackathons, and ecosystem builder programs.

**Understand → Build → Test → Deploy**

### Corelia Academy

**Turning developer stacks into learning journeys that lead to working products.**
$md$),
('en', 'sui-learning-tour-campus-awareness-to-student-builders', 'sui-learning-tour-campus-awareness-to-student-builders', 'case-study', 'published', $md$Sui Learning Tour: From Campus Awareness to Real Student Builders$md$, $md$How Corelia transformed university outreach for the Sui ecosystem into a repeatable journey from discovery and localized education to products, Demo Days, and continued builder opportunities.$md$, 'corelia-team', 'community-success-stories', ARRAY['web3','move-language','dapp-development','ecosystem','mentorship','project-based']::text[], '{"type":"image","src":"/blog/sui-huit.jpg","alt":"Sui Learning Tour with university students in Vietnam","fit":"cover","ogSrc":"/blog/og/sui-huit.jpg"}'::jsonb, '2026-08-25'::date, '2026-08-25'::timestamptz, '2026-08-25'::timestamptz, $md$**University Developer Education · Sui Ecosystem**

Introducing a blockchain ecosystem to university students is easy. Helping those students become builders is much harder.

The Sui Learning Tour became one of Corelia Academy's earliest large-scale experiments in solving that problem. Instead of treating university outreach as a sequence of one-off introductory events, the program developed a progression in which students could discover Sui, learn Move and on-chain development, build applications, participate in Mini Hackathons, present projects, and continue into wider ecosystem opportunities.

The model evolved into a simple journey: **Discover → Learn → Build → Demo → Continue**.

## The Challenge

Emerging technology ecosystems often enter universities through a familiar format: a speaker presents the technology, students listen, photos are taken, and the event ends.

This can create awareness, but awareness alone does not create developers. For students encountering blockchain for the first time, the distance between hearing about Sui and building a working application is significant.

They need foundational blockchain knowledge. They need to understand how Sui differs from other architectures. They need to learn Move, gain technical practice, find a reason to keep building, and eventually have a place to demonstrate what they have learned.

Corelia designed the Sui Learning Tour around that entire progression.

## The Corelia Approach

![Students learning about Sui and blockchain fundamentals](/blog/sui-huit-1.jpg)

The program brought localized developer education directly into university environments. Rather than beginning with highly technical documentation, early sessions connected blockchain fundamentals with Sui, career opportunities, product thinking, security, and hackathon participation.

Students could then progress into more technical activities involving Move, smart contracts, wallets, dApps, and hands-on development. The strongest campus journeys continued beyond workshops into bootcamps, Mini Hackathons, SuiHub Discovery activities, and Demo Days.

This meant a university could move through several levels of engagement instead of receiving the same introductory event repeatedly.

## 1. Discover

The first goal was to make the ecosystem understandable. Students explored blockchain fundamentals, Sui's architecture, Move, wallets, on-chain applications, and practical use cases.

Public program recaps show the model reaching a wide range of university communities:

- More than **200 engineering students** joined the UTC2 workshop.
- A Van Lang University session brought together **nearly 140 students**.
- The HUIT kick-off attracted **more than 220 students**.
- At UEF, **nearly 100 students** joined an opening session designed as the beginning of a longer structured journey.

These numbers matter, but reach was only the first layer. The next question was always: **Who wants to continue building?**

## 2. Learn

![Sui Learning Tour session at Van Lang University](/blog/sui-vanlang-2.jpg)

For students who wanted to move further, Corelia introduced deeper technical learning. Campus activities progressed from blockchain fundamentals into Move programming, smart contract logic, wallets, dApp development, and practical development workflows.

The program appeared across communities including UIT, Gia Dinh University, UTC2, Viet My College, Van Lang University, Van Hien University, UEF, HUIT, and later the ITC Web3 Engineer journey. Corelia's public recaps document this progression across late 2025 and the first half of 2026.

Localization was important. The objective was not simply to translate technical terminology, but to teach concepts in an order that made sense to students who might have strong general programming skills yet little prior exposure to blockchain or Move.

## 3. Build

The program became significantly more valuable when students stopped being an audience and started becoming developers.

Hands-on sessions required learners to work with the technology directly. Students moved from understanding smart contracts to creating them; from discussing wallets to integrating them; from hearing about dApps to building interfaces around on-chain logic; and from following examples to developing project ideas of their own.

This change from passive learning to active building is the central idea behind the Sui Learning Tour. Corelia was not trying to optimize only for workshop attendance. The deeper objective was **builder conversion**.

## 4. Demo

![Fourteen student teams presenting products at the ITC Web3 Builders Demo Day](/blog/corelia-itc-demoday-2026/corelia-itc-demoday-2.png)

One of the clearest examples of that conversion came through Corelia's Web3 Engineer – Sui Blockchain journey at ITC. The program progressed through hands-on sessions covering Sui Move, smart contracts, tokens, dApp interfaces, and wallet integration.

At the final Web3 Builders Hackathon and Demo Day, **14 teams presented Web3 products they had built themselves**. That outcome fundamentally changes what a student can say after completing the journey: from “I attended a blockchain workshop” to **“My team built and demonstrated a product on Sui.”**

Students had to identify problems, prioritize features, implement smart contract logic, connect product interfaces, collaborate as teams, prepare live demonstrations, and respond to evaluation.

Six of the highest-performing teams were then selected to progress toward an inter-university competition, while the program also opened potential pathways toward internships and continued ecosystem participation. That is the difference between awareness and activation.

## 5. Continue

A successful education program should not end when the final slide is presented. The Sui Learning Tour was designed to connect stronger students with the next opportunity: advanced training, developer communities, Mini Hackathons, larger competitions, mentorship, internships, and ecosystem programs.

This creates a funnel in which many students can discover the ecosystem while increasingly committed participants move toward deeper technical involvement. Not every attendee needs to become a Sui developer, but students who do want to build should have a clear next step.

## The University Activation Model

The Sui Learning Tour helped Corelia develop a repeatable framework for ecosystem education:

### Awareness

Introduce the technology through language and contexts students can understand.

### Education

Provide structured technical foundations instead of sending learners directly into documentation.

### Practice

Give students an environment in which they must use the technology themselves.

### Product

Connect technical learning to something that can actually be demonstrated.

### Validation

Use Mini Hackathons and Demo Days to create deadlines, feedback, and evidence of capability.

### Continuation

Connect the strongest builders with opportunities beyond the original university program.

The framework is intentionally modular. A university can begin with one workshop. A stronger cohort can continue into a bootcamp. Builders can progress into a Mini Hackathon, and the best projects can move further into the ecosystem.

## Corelia's Role

Corelia operated across the local education and activation layer:

**University Activation · Localized Education · Technical Workshops · Developer Training · Learning Experience Design · Mentorship · Mini Hackathons · Demo Days · Builder Community**

This required more than event operations. Corelia translated ecosystem concepts into campus learning experiences, worked with universities, designed technical journeys, coordinated contributors, guided students through building, and created opportunities for learners to demonstrate their progress.

## Why This Case Matters

The Sui Learning Tour became an important proof point for Corelia because it demonstrated that university ecosystem activation can move beyond reach metrics.

A workshop can create awareness. A bootcamp can develop skills. A Mini Hackathon can create products. A Demo Day can reveal builders. A continuing community can keep those builders connected after the original program ends.

When these pieces are connected, university outreach becomes much more valuable than event marketing. It becomes **developer pipeline infrastructure**.

That lesson later became foundational to how Corelia approaches larger education and ecosystem programs.

**Discover → Learn → Build → Demo → Continue**

### Corelia Academy

**Bringing global technology ecosystems closer to the next generation of builders.**
$md$),
('en', 'sui-learning-tour-gia-dinh-university-2025', 'sui-learning-tour-gia-dinh-university-2025', 'blog', 'published', $md$Recap: Sui Learning Tour x Gia Dinh University 2025: Igniting Web3 Passion in the Next Generation of Developers$md$, $md$Recap of the Training Workshop at GDU (Nov 1, 2025): from Blockchain Dev Fundamentals and Hackathon Mastery to Live Move coding and Slush Wallet Challenge, with speakers from Sui Foundation, OLYM3, and First Movers Vietnam.$md$, 'terran', 'career-ecosystem-insights', ARRAY['web3','blockchain-fundamentals','ecosystem','hackathon','move-language','career-tips']::text[], '{"type":"image","src":"/blog/574601865_1608964343799696_3483529006715381870_n.jpg","alt":"Sui Learning Tour x Gia Dinh University 2025 - Training Workshop","ogSrc":"/blog/og/574601865_1608964343799696_3483529006715381870_n.jpg"}'::jsonb, '2025-11-01'::date, '2025-11-01'::timestamptz, '2025-11-01'::timestamptz, $md$On the morning of November 1, 2025, the "Sui Learning Tour" tech roadshow officially landed at Gia Dinh University (GDU), bringing an intense and inspiring Training Workshop. The event drew a large crowd of students, young developers, and tech enthusiasts to Hall B to explore the vast potential of Blockchain and Web3.

## 1. Spreading Blockchain Knowledge to GDU

![Sui Learning Tour x Gia Dinh University 2025 - Workshop Opening](/blog/577026724_1608962507133213_1756685810773723956_n.jpg "The opening scene of the Sui Learning Tour at GDU, capturing the excitement and engagement of student attendees as the workshop begins.")

As one of the key stops on the nationwide Sui Learning Tour, this edition was co-organized by the **Sui Community**, **GDU Coder Club**, and **First Movers Vietnam**.

Rather than sticking to dry theory, the 4-hour workshop was designed as a real launchpad, helping GDU students get hands-on with the Sui ecosystem: a high-performance, developer-friendly blockchain platform. It was the perfect stepping stone for the next generation of developers to move from "traditional" dev to the promising Web3 space.

## 2. Deep Expertise From a Stellar Speaker Line-up

![Sui Learning Tour x Gia Dinh University 2025 - Workshop Opening](/blog/576202541_1608964237133040_4776484432963071892_n.jpg)

One of the event’s biggest strengths was the depth of expertise shared by leading industry practitioners. The audience was taken through several engaging topics:

- **Blockchain Dev Fundamentals & Career Opportunities:** On-chain vs off-chain thinking, an overview of the Move language, and a look at career opportunities in the Web3 era.
- **Hackathon Mastery:** Tips from top-tier teams on ideation, time management, and effective project pitching.

The event was honored to feature:

- **Thái Phạm Ngọc Tường**: Developer Ambassador, Sui Foundation & Founder, Corelia Academy.
- **Mai Thanh Nhã**: Director, OLYM3; Chainlink Developer Expert.
- **Phan Hoàng Vinh Hiển**: Developer Relations, First Movers Vietnam.
- **Nguyễn Hà Phúc**: Developer Ambassador, Sui Foundation.

## 3. Hands-on Sessions & Attractive Perks

![Sui Learning Tour x Gia Dinh University 2025 - Workshop Opening](/blog/574911557_1608962587133205_1420610341953389485_n.jpg)

Unlike typical seminars, Sui Learning Tour x GDU was highly practical and interactive:

- **Live Coding Session:** Students watched and followed step-by-step how to build, deploy, and test a basic smart contract in Move on the Sui testnet.
- **Mini-game "Slush Wallet Challenge":** The room heated up as participants tried the Slush wallet with live on-chain challenges and competed for SUI token rewards.

Participants who completed the full program also received a **Workshop Completion Certificate**, a strong addition to their profile and a gateway to future projects and Hackathons in the Sui ecosystem.

## 4. Closing

Sui Learning Tour x Gia Dinh University 2025 was a clear success, going well beyond a standard workshop. It was a real hub for the Web3 developer community, where early ideas can grow into breakthrough dApps in the future.

A sincere thank you to the leadership of Gia Dinh University, GDU Coder Club, First Movers Vietnam, and all the students who made the event possible.

Keep sharpening your Move skills and follow the Sui Community for upcoming activities, courses, and Hackathon opportunities. Together we’ll build a stronger Web3 future in Vietnam!
$md$),
('en', 'sui-learning-tour-huit-2026', 'sui-learning-tour-huit-2026', 'blog', 'published', $md$220+ University of Industry and Trade Students Unlock Web3 with Sui Learning Tour$md$, $md$Kick-off at University of Industry and Trade, HCMC: over 220 students explored Blockchain & Sui fundamentals, career opportunities, and hands-on Hackathon mindset.$md$, 'terran', 'career-ecosystem-insights', ARRAY['web3','blockchain-fundamentals','ecosystem','hackathon','move-language','career-tips']::text[], '{"type":"image","src":"/blog/sui-huit.jpg","alt":"Sui Learning Tour x HUIT 2026 - Kick-off at University of Industry and Trade, Ho Chi Minh City","ogSrc":"/blog/og/sui-huit.jpg"}'::jsonb, '2026-01-01'::date, '2026-01-01'::timestamptz, '2026-01-01'::timestamptz, $md$Over 220 students and young developers packed the hall at the University of Industry and Trade, Ho Chi Minh City (HUIT) for the opening Kick-off of Sui Learning Tour 2026. Sui Foundation, together with HUIT and First Movers Vietnam, ran the session around **Learn – Build – Validate – Connect**, turning the first stop into a solid springboard before the upcoming Bootcamps and Mini Hackathon.

## 1. Foundation Before Code

![Sui Learning Tour x HUIT 2026 - Speaker presenting Blockchain fundamentals at University of Industry and Trade](/blog/sui-huit-1.jpg)

Instead of a theory-only seminar, the program focused on building the right mindset: students got a clear picture of the Blockchain and Sui ecosystem before touching complex code. That’s how HUIT and partners are designing a sustainable pipeline: from young developer to project, Hackathon, and Grant or career opportunities.

## 2. Four Knowledge Pillars in One Session

![Sui Learning Tour x HUIT 2026 - Audience at University of Industry and Trade](/blog/sui-huit-2.jpg)

The room was taken through four core areas:

- **Decoding Blockchain & Web3:** Smart Contracts, Wallets, Tokens, NFTs, and the shift from Web2 to a decentralized world.

- **Sui Blockchain overview:** Object-centric architecture, the security strengths of Move, and real-world applications leading the market: DeFi, GameFi, DePIN.

- **Digital economy & career opportunities:** A full view of Blockchain’s role in digital transformation, potential job roles, and career paths for IT students.

- **Hands-on Hackathon mindset:** Tips from ideation and team roles to "build fast – demo clear" skills to win over judges.

## 3. The 2026 Roadmap Is Live

![Sui Learning Tour x HUIT 2026 - Presentation moment at University of Industry and Trade](/blog/sui-huit-3.jpg)

By the end of the Kick-off, the next steps were clear: **Sui x AI Bootcamp** (AI to support learning and coding), **Mini Hackathon & Demo Day** (prove your skills in practice), and Hackathon prizes and Grants from the global Sui ecosystem. HUIT students are mentally ready for what’s ahead.

## 4. Closing

The HUIT Kick-off closed with over 220 young participants: clear proof of Web3’s pull on campus and of a generation ready to master the technology. Thanks to the University of Industry and Trade, Ho Chi Minh City, and all the students who made the event memorable; see you at the next Bootcamp rounds.
$md$),
('en', 'sui-learning-tour-uef-2026', 'sui-learning-tour-uef-2026', 'blog', 'published', $md$Safe Web3 Kick-off at UEF: Nearly 100 Students Start a Structured Journey$md$, $md$Workshop #1 Kick-off at UEF: Introduction to Blockchain & Sui drew nearly 100 students, laying the foundation for Web3 mindset, career path, and security before Bootcamps and Hackathons.$md$, 'terran', 'career-ecosystem-insights', ARRAY['web3','blockchain-fundamentals','ecosystem','career-tips','move-language']::text[], '{"type":"image","src":"/blog/sui-uef.jpg","alt":"Sui Learning Tour x UEF 2026 - Kick-off Workshop at University of Economics and Finance, Ho Chi Minh City","ogSrc":"/blog/og/sui-uef.jpg"}'::jsonb, '2026-01-01'::date, '2026-01-01'::timestamptz, '2026-01-01'::timestamptz, $md$Nearly 100 students from the University of Economics and Finance, Ho Chi Minh City (UEF), showed up for Workshop #1: "Kick-off: Introduction to Blockchain & Sui": the latest stop of the Sui Learning Tour in 2026. Sui Foundation, together with UEF and First Movers Vietnam, didn’t just open the door to the decentralized world; they put **information and digital asset security** front and centre from step one.

## 1. More Than an "Entry Point": A Proper Springboard

![Sui Learning Tour x UEF 2026 - Kick-off workshop at University of Economics and Finance](/blog/sui-uef-1.jpg)

The workshop was designed as a transfer station: set the mental foundation, map the path, and equip participants with security know-how before they join technical Bootcamps and Hackathons. The aim is to help newcomers understand Web3 clearly and fully without getting lost in its breakneck pace.

## 2. Content: From Fundamentals to Career Opportunities

![Sui Learning Tour x UEF 2026 - Presenters and participants at University of Economics and Finance](/blog/sui-uef-2.jpg)

Two main pillars of the Kick-off:

- **Blockchain Fundamentals & Sui Overview:** Core concepts (Web2 vs Web3, Smart Contracts, Wallets) were untangled in plain terms. Sui’s strengths: object-centric architecture and the Move language: were introduced as a foundation for building safely and effectively.

- **Web3 Career Path & Hackathon Opportunities:** A clear picture of the Web3 job market and the practical path *Student → Build Project → Hackathon → Job/Grant* gave young builders a concrete direction instead of theory only.

## 3. UEF’s Standout: Web3 Security: A "Survival" Mindset

![Sui Learning Tour x UEF 2026 - Participants at University of Economics and Finance](/blog/sui-uef-3.jpg)

What set the UEF Kick-off apart was the module on **information and digital asset security.** Before becoming a builder, you need to be a safe user. Experts walked through real case studies on Phishing, Scams, and Smart Contract Exploits, shared principles for protecting personal assets, and stressed developers’ security responsibility when building dApps.

## 4. What Comes Next

Workshop #1 closed with everyone ready for the next leg: the roadmap for UEF students is now "unlocked": **SUI x AI Bootcamp** and **Mini Hackathon – Demo Day** are ahead. Thanks to UEF and all participants for the energy; sign up for the in-depth programs and get ready for the "Build real, go long" journey with Sui.
$md$),
('en', 'sui-learning-tour-utc2-2025', 'sui-learning-tour-utc2-2025', 'blog', 'published', $md$Recap: Sui Learning Tour x UTC2: Web3 Passion for 200+ Engineering Students$md$, $md$Recap of the workshop at UTC2 (Nov 8, 2025): from Blockchain Dev Fundamentals and Hackathon Mastery to Live Move coding and Slush Wallet Challenge, with speakers from Sui Foundation and First Movers Vietnam.$md$, 'terran', 'career-ecosystem-insights', ARRAY['web3','blockchain-fundamentals','ecosystem','hackathon','move-language','career-tips']::text[], '{"type":"image","src":"/blog/sui-utc2.jpg","alt":"Sui Learning Tour x UTC2 2025 - Workshop at University of Transport and Communications, Ho Chi Minh City Campus","ogSrc":"/blog/og/sui-utc2.jpg"}'::jsonb, '2025-11-08'::date, '2025-11-08'::timestamptz, '2025-11-08'::timestamptz, $md$On November 8, 2025, over 200 students and young developers gathered at the University of Transport and Communications, Ho Chi Minh City Campus (UTC2) in Thu Duc for the Sui Learning Tour stop. Sui Community and First Movers Vietnam gave a full 4 hours to break down conceptual barriers and bring everyone face-to-face with the Sui ecosystem: a high-performance, secure, developer-friendly blockchain.

## 1. Blockchain on Campus: More Than a Trend

![Sui Learning Tour x UTC2 2025 - Workshop opening at University of Transport and Communications, HCMC Campus](/blog/sui-utc2-1.jpg)

The goal was to spread Web3 knowledge and practice to students across the country. At UTC2, Blockchain was presented as a technology foundation shaping the future: not just concepts but direct hands-on exposure.

## 2. Deep Expertise From an Experienced Speaker Line-up

![Speakers at Sui Learning Tour x UTC2 2025](/blog/sui-utc2-2.jpg)

The workshop’s main draw was the "hands-on" sharing sessions led by leading industry experts:

- **Thái Phạm Ngọc Tường**: Developer Ambassador, Sui Foundation & Founder, Purro Wallet
- **Victor Lương**: Host/Content Creator, ETH34 & DeFi.vn
- **Phan Hoàng Vinh Hiển**: Developer Relations, First Movers Vietnam
- **Nguyễn Hà Phúc**: Developer Ambassador, Sui Foundation

Speakers guided participants from Blockchain Dev Fundamentals (on-chain vs off-chain thinking, an overview of the Move language) to a deep dive into Career & Market Opportunities in both local and global markets. The Hackathon Mastery segment equipped young builders with ideation, teamwork, and effective pitching skills drawn from top-tier teams.

## 3. Hands-on Experience: From Live Coding to the Slush Wallet Challenge

![UTC2 students practicing at Sui Learning Tour workshop](/blog/sui-utc2-3.jpg)

The energy in the UTC2 hall stayed high thanks to continuous interactive activities:

- **Live Coding Session:** Students did not only listen to theory: they watched step-by-step how to build, deploy, and test a basic smart contract in Move on the Sui testnet.
- **On-chain mini-game:** The "Slush Wallet Challenge" gave participants real hands-on experience with the Slush wallet on Sui and the chance to win SUI token rewards and other prizes from the organizers.

Everyone who completed the full program received a **Workshop Completion Certificate**, opening the door to in-depth study groups, projects, and major Hackathons in the future.

## 4. Closing

The UTC2 workshop showed what it takes to bring quality Web3 education and developer resources closer to students: a core mission for initiatives like Corelia Academy. Over 200 young participants here gave the Sui Learning Tour momentum to continue to Van Lang and Van Hien in December. Thanks to UTC2, First Movers Vietnam, and all the students who made the weekend morning meaningful; let’s keep learning and building the Web3 future in Vietnam together.
$md$),
('en', 'sui-learning-tour-van-hien-university-2025', 'sui-learning-tour-van-hien-university-2025', 'blog', 'published', $md$Build on Sui at Van Hien: Technical Foundation Before the Mini Hackathon$md$, $md$Recap of Technical Workshop (Session 1) at Van Hien University (Dec 16, 2025): Build on Sui Blockchain: from Blockchain Dev Fundamentals, Career & Hackathon Mastery to Live Move coding, with speakers from Sui Foundation, OLYM3, and First Movers Vietnam.$md$, 'terran', 'career-ecosystem-insights', ARRAY['web3','blockchain-fundamentals','ecosystem','hackathon','move-language','career-tips']::text[], '{"type":"image","src":"/blog/sui-vanhien.jpg","alt":"Sui Learning Tour x Van Hien University 2025 - Build on Sui Technical Workshop at Hung Hau Campus","ogSrc":"/blog/og/sui-vanhien.jpg"}'::jsonb, '2025-12-16'::date, '2025-12-16'::timestamptz, '2025-12-16'::timestamptz, $md$On the morning of December 16, 2025, over 180 IT students at Van Hien University (Hung Hau Campus) joined the first Technical Workshop under the theme "Build on Sui Blockchain". It was the springboard for two weeks of online project practice and the upcoming Mini Hackathon: the Sui Community focused on hands-on tech, not just trends.

## 1. Essential Gear to Become a Blockchain Developer

![Sui Learning Tour x Van Hien University 2025 - Technical Workshop opening at Hung Hau Campus](/blog/sui-vanhien-1.jpg)

As a pivotal kick-off, the event equipped Van Hien students with a solid foundation in Blockchain and the Sui ecosystem before they enter two weeks of online project practice and the intensive Mini Hackathon. That foundation is the "necessary condition" to build in the right direction.

## 2. The Journey: From Mindset to Career Path

![Speakers at Sui Learning Tour x Van Hien University 2025](/blog/sui-vanhien-2.jpg)

Throughout the 4-hour program, students were guided through core content by leading experts:

- **Blockchain Dev Fundamentals:** Thái Phạm Ngọc Tường (Developer Mentor, Sui Foundation) helped students structure on-chain/off-chain thinking and showcased the power of the Move language.
- **Career & Market Opportunities:** From the perspective of an international investment fund, Mr. Nhã (Director, OLYM3) outlined the Web3 market landscape and what employers and investors are looking for today.
- **Hackathon Mastery:** Phan Hoàng Vinh Hiển (Developer Relations, First Movers Vietnam) shared practical tips on ideation, building a demo, and persuasive pitching.

## 3. Hands-on Highlight: Build Your First Move Contract

![Van Hien students during Live Coding: writing and deploying their first Smart Contract](/blog/sui-vanhien-3.jpg)

The atmosphere at Hung Hau Campus peaked during the Live Coding Workshop. With step-by-step guidance from Developer Ambassadors Trần Tấn Phát and Nguyễn Hà Phúc, students with laptops got to:

- **Set up** their development environment with Sui CLI.
- **Write**, compile, and deploy their first Smart Contract right in the classroom.

Between intense coding moments, a lively Mini Quiz kept the room engaged and gave participants the chance to win tech prizes.

## 4. Closing: Ready for What’s Next

The Workshop wrapped up with an in-depth Q&A where students and speakers debugged technical issues and discussed project ideas. The goal of passing on the flame and arming future builders with technical tools was met. Van Hien students have now entered Phase 2: two weeks of online project practice. Apply what you’ve learned, keep the team spirit strong, and get ready to shine at the Mini Hackathon. Thanks to Van Hien University and all the students who made the morning so full of energy: together we’re building the Web3 future in Vietnam step by step.
$md$),
('en', 'sui-learning-tour-van-lang-university-2025', 'sui-learning-tour-van-lang-university-2025', 'blog', 'published', $md$Web3 Gaming & Blockchain at Van Lang: Nearly 140 Students with Sui$md$, $md$Recap of the workshop at VLU (Nov 6, 2025): Blockchain Technology & Web3 Gaming, from Blockchain Dev Fundamentals and On-chain Game Design to Live Move coding and Slush Wallet Challenge, with speakers from Sui Foundation, NamLongDAO, and First Movers Vietnam.$md$, 'terran', 'career-ecosystem-insights', ARRAY['web3','blockchain-fundamentals','ecosystem','hackathon','move-language','career-tips']::text[], '{"type":"image","src":"/blog/sui-vanlang.jpg","alt":"Sui Learning Tour x Van Lang University 2025 - Blockchain Technology & Web3 Gaming Workshop","ogSrc":"/blog/og/sui-vanlang.jpg"}'::jsonb, '2025-12-06'::date, '2025-12-06'::timestamptz, '2025-12-06'::timestamptz, $md$The theme "Blockchain Technology & Web3 Gaming: Career Opportunities" brought nearly 140 Van Lang University (Main Campus) students to Room F.08.04 on the morning of December 6, 2025. The Sui Community ran a session just for VLU, offering a fresh angle: how blockchain is reshaping gaming and decentralized applications.

## 1. When the Campus Becomes the Cradle for Future Builders

![Sui Learning Tour x Van Lang University 2025 - Workshop opening at Room F.08.04](/blog/sui-vanlang-1.jpg)

The event wove together core technical foundations and the Web3 Gaming trend. Students explored Sui: high throughput, low cost, and a strong fit for complex on-chain games: through a practical, market-oriented lens.

## 2. Expert Speakers Leave Their Mark

![Speakers at Sui Learning Tour x Van Lang University 2025](/blog/sui-vanlang-2.jpg)

Throughout the 4-hour program, the energy in Room F.08.04 stayed high thanks to in-depth, practical talks from the speaker line-up:

- **Thái Phạm Ngọc Tường**: Developer Mentor, Sui Foundation; Founder, Purro Wallet & Corelia Academy
- **Hải Long**: Founder, NamLongDAO
- **Phan Hoàng Vinh Hiển**: Developer Relations, First Movers Vietnam
- **Trần Tấn Phát & Nguyễn Hà Phúc**: Developer Mentors, Sui Foundation

Speakers took students from Blockchain Dev Fundamentals (decentralized data architecture, Sui’s object model, the Move language) to On-chain Game Design (true digital ownership, on-chain game logic). The Hackathon Mastery segment also shared practical tips to help students confidently ideate and design products for tech competitions.

## 3. Learn: Play: Build: On-chain Interaction That Keeps You Hooked

![VLU students practicing Live Coding and Slush Wallet Challenge at the workshop](/blog/sui-vanlang-3.jpg)

What set the workshop apart was the stream of interactive activities:

- **Live Coding Session:** VLU students watched the full flow of writing, deploying, and testing a smart contract in Move on Sui Devnet/Testnet.
- **Mini-game "Slush Wallet Challenge":** The room joined in on-chain challenges via the Slush wallet. Interacting with contracts and earning real SUI token rewards gave participants a clearer picture of the user experience in Web3.

Students who attended the full program received a **Workshop Completion Certificate**, a strong addition to their CV for tech recruiters.

## 4. Closing

Sui Learning Tour x Van Lang University 2025 wrapped up with a strong impression and renewed passion for tech in the VLU community. It was a solid springboard for young builders to seize career opportunities and become pioneers in Blockchain & Web3 Gaming in Vietnam. Thanks to Van Lang University and all the students; keep honing your Move skills and follow Sui Community for the next Hackathon opportunities.
$md$),
('en', 'sui-learning-tour-webdev-studios', 'sui-learning-tour-webdev-studios', 'blog', 'published', $md$Recap: Sui Learning Tour x WebDev Studios: Exploring Blockchain Technology with IT Students$md$, $md$Recap of the Blockchain Technology Workshop at UIT (Sept 17, 2025): from concepts to practical tools, insights from Sui experts, and networking opportunities for students.$md$, 'terran', 'career-ecosystem-insights', ARRAY['web3','blockchain-fundamentals','ecosystem','hackathon']::text[], '{"type":"image","src":"/blog/sui-learning-tour-webdev.jpg","alt":"Sui Learning Tour x WebDev Studios - Blockchain Technology Workshop","ogSrc":"/blog/og/sui-learning-tour-webdev.jpg"}'::jsonb, '2025-09-17'::date, '2025-09-17'::timestamptz, '2025-09-17'::timestamptz, $md$On September 17, 2025, the event "Sui Learning Tour x WebDev Studios: Blockchain Technology Workshop" was successfully held at the University of Information Technology, VNU-HCM (UIT). With the mission of unlocking the potential of Web3 and blockchain, the workshop attracted many tech-minded students from the Ho Chi Minh City area.

## 1. From "Hot Keyword" to Practical Tool

![Sui Learning Tour x WebDev Studios - Blockchain Technology Workshop](/blog/NVA05575.JPG)

We live in a digital era where blockchain is reshaping the world: from decentralized finance (DeFi), NFTs, and the metaverse to countless other Web3 applications with greater transparency and security.

With that in mind, the Sui Community partnered with WebDev Studios to run a workshop that provided both foundations and a practical perspective. At the event, blockchain was presented not as a distant concept but as a real tool, opening new creative opportunities for young developers.

## 2. Highlights of the Workshop

![Sui Learning Tour x WebDev Studios - Blockchain Technology Workshop](/blog/NVA05646.JPG)

The event ran from 1:00 PM to 4:30 PM at Hall E, UIT, in an energetic atmosphere. Notable highlights included:

**Expert insights:** The workshop featured speaker Thái Phạm Ngọc Tường: Developer Ambassador at SuiHub Ho Chi Minh City. Drawing on hands-on experience, he gave an overview of current tech trends and how to build on the Sui ecosystem.

**Interaction & networking:** Beyond one-way theory, students from universities actively asked questions and joined the discussion. It was also a great chance to connect with others who share a passion for technology.

**Perks:** The event was free to attend. Attendees also received giveaways from the organizers during the program, and UIT students were eligible for extra training credits.

## 3. Closing

![Sui Learning Tour x WebDev Studios - Blockchain Technology Workshop](/blog/NVA05743.JPG)

Sui Learning Tour x WebDev Studios: Blockchain Technology Workshop wrapped up successfully, meeting its goal of supporting Vietnamese students on their Web3 journey. Through the event, participants not only gained knowledge but also drew inspiration to grow and build with confidence.

Thank you to all the students who attended and made the atmosphere so lively. Stay tuned and follow the Sui Community so you don’t miss the next events and projects!
$md$),
('en', 'unihackfest-2026-university-to-builder-pipeline', 'unihackfest-2026-university-to-builder-pipeline', 'case-study', 'published', $md$UniHackFest 2026: Building a University-to-Builder Pipeline$md$, $md$How Corelia designed a 14-week AI and Web3 journey that moves university students from learning and market insight to working products, validation, and Demo Day.$md$, 'corelia-team', 'community-success-stories', ARRAY['web3','ecosystem','mentorship','project-based','hackathon','dapp-development']::text[], '{"type":"image","src":"/blog/corelia-uef-khoi-dong-unihackfest-unitour-2026/UEF01929.jpg","alt":"Students, organizers, and ecosystem partners at the UniHackFest 2026 launch at UEF","fit":"cover"}'::jsonb, '2026-08-25'::date, '2026-08-25'::timestamptz, '2026-08-25'::timestamptz, $md$**National University Innovation Program · AI × Web3**

A hackathon can attract attention in a weekend. Building capable student builders takes much longer.

UniHackFest 2026 was created around that difference. Co-organized by Corelia Academy and the University of Economics and Finance, Ho Chi Minh City (UEF), UniHackFest is a 14-week learning and competition program designed to help university students move from identifying a real problem to building, validating, and pitching an AI and Web3 product.

Rather than asking students to arrive with a finished idea and start competing immediately, Corelia designed the program around a simple principle: **learn before you compete**.

## The Challenge

Traditional student hackathons often compress the entire builder journey into a few days. Participants may have strong motivation, but they frequently enter with very different levels of technical knowledge, product thinking, market understanding, and presentation experience.

This creates several problems. Some teams spend most of the competition learning tools instead of building. Others produce technically interesting prototypes without understanding the users or market behind them. Non-technical students may struggle to understand where they fit. Once Demo Day ends, much of the learning momentum can disappear with it.

Corelia wanted to design a different model. The goal was not simply to create more hackathon participants, but to build a **structured pathway that could turn university students into builders**.

## The Corelia Approach

![A UEF student taking part in the UniHackFest learning session](/blog/corelia-uef-khoi-dong-unihackfest-unitour-2026/UEF01864.jpg)

UniHackFest was designed as a connected system rather than a collection of independent events. Students move through five learning areas:

**Market Insight → AI Product Building → Rust Survival Kit → Solana Bootcamp → Pitching**

Each stage produces a tangible output:

**Market Memo → AI Product MVP → Rust On-chain Lab → Solana dApp on Devnet → Pitch Deck & Demo**

Learning is therefore directly connected to what participants ultimately need to build and present. Market education helps teams identify a meaningful problem. AI Product Building turns that understanding into an MVP. Rust and Solana provide the technical foundation for verifiable on-chain products. Pitching requires teams to explain what they built, who needs it, and why it matters.

By qualification and Demo Day, teams are expected to show evidence of product development and technical execution: not an idea that exists only on slides.

## A Full Builder Journey

### 1. UniTour: Discover

Corelia brings the program directly to university campuses. Students are introduced to AI, digital assets, Web3, Solana, product thinking, industry perspectives, and the different roles required to build a technology product.

The objective is broader than event awareness. UniTour acts as the acquisition layer for the builder pipeline.

### 2. Structured Learning: Understand

Students continue through learning tracks designed around the capabilities required to build a product. Instead of consuming disconnected technical content, participants understand how market research, AI, programming, blockchain infrastructure, product decisions, and communication connect.

### 3. Mentoring and Building: Apply

Teams turn what they learn into prototypes. Mentors help participants refine scope, solve technical problems, improve product decisions, and prepare for evaluation.

### 4. Qualification: Validate

Teams must demonstrate what they have actually built. Qualification creates a checkpoint between learning and competition, raising the standard before teams reach the final stage.

### 5. Demo Day: Show What Works

The strongest teams bring together product, technology, market understanding, and communication in a final demonstration.

The complete journey becomes: **Discover → Learn → Build → Validate → Demo**.

## Bringing an Ecosystem into the University Journey

![UniHackFest campus activation connecting students with the ecosystem](/blog/corelia-unihackfest-unitour-van-lang-2026/_DSC2776.jpg)

UniHackFest also demonstrates how Corelia works as an interface between global technology ecosystems and Vietnamese universities.

Solana participates as a technical blockchain ecosystem partner, while MEXC Ventures contributes market and digital asset perspectives. Other contributors across the broader program have included Open Campus, developer communities, industry experts, and university partners.

Instead of placing partner logos around a one-day event, the program integrates ecosystem knowledge into the student journey. Students encounter the ecosystem during campus activities, learn the technology through structured courses, use it while building, receive feedback from practitioners, and demonstrate what they can create with it.

This transforms ecosystem sponsorship from **visibility** into **participation and builder development**.

## From One Campus to a Multi-City Program

![UniHackFest Da Nang Campus program](/blog/corelia-unihackfest-da-nang-campus-2026/IMG_1745.jpg)

UniHackFest officially launched at UEF on June 15, 2026. The journey then expanded through university activities including Hung Vuong University, ITC, Van Lang University, the Academy of Cryptography Techniques HCMC, Van Hien University, and a Da Nang Campus program organized with BTEC FPT Da Nang and DUT Superteam University Club.

The original program design targets a 15-university campus journey and more than 2,000 students, supported by five hands-on courses and two competition directions covering Product & Business and Technical Build. These remain program-scale objectives until the full 2026 cycle is completed.

As of August 25, 2026, UniHackFest is still in progress. That distinction matters. The strongest evidence today is not a final participant number; it is that the model has moved beyond a launch announcement into repeated campus activation, learning, ideation, technical education, and builder preparation across multiple university communities.

## Corelia's Role

Corelia operates as the **education and program architecture layer** behind the journey. Its responsibilities span:

**Program Design · Curriculum Development · University Partnerships · Ecosystem Coordination · Campus Activation · Mentorship · Technical Education · Qualification Design · Community Building**

The work begins before an event is announced and continues long after students leave the first workshop. That continuity is what turns a series of activities into a program.

## Why This Case Matters

UniHackFest represents Corelia's largest experiment in combining three things that are usually separated: **education, ecosystem activation, and product building**.

A university workshop can create awareness. A course can create knowledge. A hackathon can create urgency. When those components are designed as one journey, however, they create something more valuable: a repeatable pipeline through which students discover a technology, learn how it works, build with it, demonstrate capability, and remain connected to the ecosystem afterward.

For Corelia, UniHackFest is more than a hackathon. It is a model for how universities and technology ecosystems can work together to develop the next generation of builders.

**Learn → Build → Validate → Ship**

### Corelia Academy

**From university learning to real builders.**
$md$),
('en', 'unihackfest-unitour-2-dhv-web3-solana-2026', 'unihackfest-unitour-2-dhv-web3-solana-2026', 'blog', 'published', $md$UniHackFest UniTour #2 at DHV: From Web3 Growth Hacking to a Builder's Journey on Solana$md$, $md$On June 18, 2026, UniHackFest UniTour #2 at Hung Vuong University HCMC featured perspectives from MEXC Ventures, Open Campus, and the Solana community on content, Web3 education, and sustainable building.$md$, 'corelia-team', 'announcements-events', ARRAY['web3','blockchain-fundamentals','dapp-development','ecosystem','project-based','hackathon']::text[], '{"type":"image","src":"/blog/unihackfest-unitour-2-dhv-web3-solana-2026/IMG_3105_SnapseedCopy.jpg","alt":"The second UniHackFest UniTour stop at Hung Vuong University Ho Chi Minh City","fit":"cover"}'::jsonb, '2026-06-18'::date, '2026-06-18'::timestamptz, '2026-06-18'::timestamptz, $md$On **June 18, 2026**, the **UniHackFest UniTour 2026** journey continued at **Hung Vuong University Ho Chi Minh City (DHV)** for the second stop in its university event series.

Following the Kick-off and UniTour #1 at UEF, the DHV workshop brought students closer to practical perspectives on Web3 Growth Hacking, innovation in Web3 education, and the journey of building sustainable products on Solana.

The three sessions featured **Ms. Jenny Nguyen – MEXC Ventures**, **Mr. Cris D. Tran – Open Campus**, and **Mr. Le Quang Dat – Solana Builder, Superteam APAC Contributor**. Each explored a different layer of a builder's journey: communicating a product to its community, understanding how Web3 can reshape education, and sustaining the process of building technology from zero.

![UniHackFest UniTour #2 at DHV: From Web3 Growth Hacking to a Builder's Journey on Solana](/blog/unihackfest-unitour-2-dhv-web3-solana-2026/IMG_3095.jpg)

## DHV – The Second Stop of UniHackFest UniTour 2026

![UniHackFest UniTour #2 at DHV: From Web3 Growth Hacking to a Builder's Journey on Solana](/blog/unihackfest-unitour-2-dhv-web3-solana-2026/IMG_3102.jpg)

UniHackFest is designed as a 14-week learning and competition journey that takes students from market insight and AI product thinking to demonstrable Web3 products and pitching. UniTour brings that journey directly to university campuses.

After the opening event at UEF on June 15, DHV became the second stop on June 18. The workshop helped students understand that Web3 is more than a collection of technical concepts. It is also a space where content, community, education, technology, and product development intersect.

For newcomers, a campus workshop can be the first step toward identifying the role that suits them. Developers can focus on products and technical infrastructure. Designers shape the user experience. Product and Business team members research users and markets. Students with strengths in content or community also play an important role in helping products reach Gen Z and generate growth.

## Web3 Growth Hacking – Breakthrough Content Creation for Gen Z

![UniHackFest UniTour #2 at DHV: From Web3 Growth Hacking to a Builder's Journey on Solana](/blog/unihackfest-unitour-2-dhv-web3-solana-2026/IMG_3103.jpg)

Representing **MEXC Ventures**, **Ms. Jenny Nguyen** presented **“Web3 Growth Hacking – Breakthrough Content Creation for Gen Z.”**

A product with a strong technical foundation still needs to be understood, trusted, and chosen by users. For Gen Z, a generation that absorbs information quickly, engages across multiple platforms, and readily recognizes inauthentic content: the way a product is communicated becomes an important part of its growth strategy.

The session placed content within the context of Web3 product development. Growth Hacking is not simply about generating more views; it is a process of testing messages, channels, and community activation methods to discover the right path to growth.

For UniHackFest participants, this perspective is especially valuable when refining market insights, user acquisition strategies, and pitches. A team needs to explain who its product serves, why the problem deserves attention, and what will motivate users to try it.

## Open Campus: Education & Innovation in Web3

![UniHackFest UniTour #2 at DHV: From Web3 Growth Hacking to a Builder's Journey on Solana](/blog/unihackfest-unitour-2-dhv-web3-solana-2026/IMG_3104.jpg)

Representing **Open Campus**, **Mr. Cris D. Tran** presented **“Open Campus: Education & Innovation in Web3.”**

Education is one of the fields with considerable room for experimentation through Web3. Open models can introduce new approaches to recognizing capabilities, managing learning identities, connecting learners with content, and giving people greater ownership of their educational achievements.

For students, innovation in education is not a distant concept. Every project, skill, and contribution forms part of their capability-building journey. When these outcomes can be recorded and verified more clearly, the gap between learning and career opportunities can also be narrowed.

The Open Campus session broadened the idea space for UniHackFest teams. Web3 can be applied not only to finance, but also to digital credentials, learning communities, educational content, and many challenges related to talent development.

## From Zero to Sustainable: A Builder's Journey on Solana

![UniHackFest UniTour #2 at DHV: From Web3 Growth Hacking to a Builder's Journey on Solana](/blog/unihackfest-unitour-2-dhv-web3-solana-2026/IMG_3101.jpg)

**Mr. Le Quang Dat – Solana Builder, Superteam APAC Contributor** presented **“From Zero to Sustainable: A Builder's Journey on Solana.”**

Starting to build a product is often easier than sustaining the journey long enough for that product to mature. Beginning from zero, a builder must continuously learn new technologies, identify the right problem, test solutions, gather feedback, and iterate.

Sustainability is not limited to technical architecture. It also comes from the ability to work with a community, build a team, choose an appropriate scope, and continue developing beyond short-term milestones such as a hackathon.

For students interested in Solana, the builder story connects the learning tracks to a longer journey. Rust Survival Kit and Solana Bootcamp provide the foundations teams need to build dApps on Devnet, but a mindset of continuous learning and improvement is what helps a project survive beyond Demo Day.

## From a Workshop to the 14-Week Journey

![UniHackFest UniTour #2 at DHV: From Web3 Growth Hacking to a Builder's Journey on Solana](/blog/unihackfest-unitour-2-dhv-web3-solana-2026/IMG_3098.jpg)

The three topics presented at DHV reflect three questions every young builder needs to answer:

- How can a product become known and embraced by its community?
- How can technology create new models for education?
- How can someone begin from zero and sustain the building journey over time?

UniHackFest helps students continue exploring these questions through five learning tracks: Market Insight, AI Product Building, Rust Survival Kit, Solana Bootcamp, and Pitching. Each creates a tangible output before teams enter the Qualification Round and Demo Day.

The DHV workshop therefore does not stand alone as an inspirational session. It connects students with the program's complete system of learning, hands-on practice, and competition.

## Corelia's Perspective: Builders Need Technology, Product, and Community

![UniHackFest UniTour #2 at DHV: From Web3 Growth Hacking to a Builder's Journey on Solana](/blog/unihackfest-unitour-2-dhv-web3-solana-2026/IMG_3099.jpg)

![UniHackFest UniTour #2 at DHV: From Web3 Growth Hacking to a Builder's Journey on Solana](/blog/unihackfest-unitour-2-dhv-web3-solana-2026/IMG_3100.jpg)

As a UniHackFest co-organizer alongside UEF, Corelia Academy follows a model in which students do not simply learn to understand; they learn to create tangible outcomes.

The DHV stop demonstrated that the builder journey does not belong only to programmers. A product needs people who understand technology, people who understand the market, people who design experiences, and people who can communicate its value to a community.

When these capabilities come together within a team, a hackathon becomes an environment where students can experiment with a more realistic way of working: defining problems, assigning roles, building an MVP, validating the product, and presenting the results.

UniTour is the first step in helping students see that complete picture. The program's next stages will take teams deeper into learning and building.

## Continuing the UniTour Journey

DHV became the second stop after UEF in the UniHackFest UniTour 2026 series. From here, the journey will continue to other campuses, connecting more students with AI, Web3, Solana, and product-building thinking.

Corelia Academy will continue working alongside UEF, its partners, and the community to create a program where students can learn for real, build for real, and apply their capabilities to products they can demonstrate.

**Explore the journey and register at [unihackfest.vn](https://unihackfest.vn).**
$md$),
('en', 'unihackfest-unitour-itc-ai-blockchain-web3-2026', 'unihackfest-unitour-itc-ai-blockchain-web3-2026', 'blog', 'published', $md$UniHackFest UniTour x ITC: Opening July with AI, Blockchain, and Web3$md$, $md$On July 1, 2026, Ho Chi Minh City Information Technology College partnered with Corelia Academy to host UniHackFest UniTour x ITC, connecting students with AI, Blockchain, Web3, Digital Assets, and Smart Contracts.$md$, 'corelia-team', 'announcements-events', ARRAY['web3','blockchain-fundamentals','smart-contracts','ecosystem','project-based','hackathon']::text[], '{"type":"image","src":"/blog/unihackfest-unitour-itc-ai-blockchain-web3-2026/4.jpg","alt":"UniHackFest UniTour x ITC","fit":"cover"}'::jsonb, '2026-07-01'::date, '2026-07-01'::timestamptz, '2026-07-01'::timestamptz, $md$On the morning of **July 1, 2026**, Ho Chi Minh City Information Technology College (**ITC**) partnered with **Corelia Academy** to successfully host the **"UniHackFest UniTour x ITC"** workshop. The event opened July with an academic and ecosystem gathering for technology-minded students, giving them access to emerging fields such as **AI, Blockchain, Web3, Digital Assets**, and **Smart Contracts**.

More than a knowledge-sharing session, UniTour x ITC became a meeting point for the college, companies, experts, and the broader technology ecosystem. Through the program, students gained practical perspectives on technologies shaping the digital era and prepared for the next stages of **UniHackFest 2026**.

## Opening July with UniHackFest UniTour x ITC

![UniHackFest UniTour x ITC: Opening July with AI, Blockchain, and Web3](/blog/unihackfest-unitour-itc-ai-blockchain-web3-2026/14.jpg)

UniHackFest UniTour is designed to bring the spirit of learning, building, and product pitching directly to campuses. At ITC, the program focused on helping students understand a fast-moving technology landscape: AI is changing how people work and create; Blockchain is introducing new trust infrastructure for data and digital assets; and Web3 is creating more opportunities for young builders to participate in global product ecosystems.

For information technology students, these topics are no longer distant ideas seen only in the news. They are becoming professional capabilities, product thinking tools, and project development opportunities. The workshop therefore served as an entry point, helping students see how classroom knowledge can connect with real needs from companies and the market.

## ITC Leadership, Faculty, and Students

![UniHackFest UniTour x ITC: Opening July with AI, Blockchain, and Web3](/blog/unihackfest-unitour-itc-ai-blockchain-web3-2026/11.jpg)

Representing ITC at the program were **Mr. Lu Quoc Tuan - Vice Rector**; **Mr. Tran Trung Viet - Vice Rector**; leaders and deputy leaders of the Faculty of Information Technology - Electronics; faculty members; and a large number of students from the faculty.

The presence of the college leadership, lecturers, and students reflected ITC's continued focus on connecting education with practical experience. In a rapidly changing technology environment, students need more than foundational knowledge. They also need opportunities to meet experts, understand how companies frame problems, and practice building in product-oriented environments.

## Connecting Companies and the Technology Ecosystem

![UniHackFest UniTour x ITC: Opening July with AI, Blockchain, and Web3](/blog/unihackfest-unitour-itc-ai-blockchain-web3-2026/1.jpg)

The workshop also welcomed representatives from **Corelia Academy**, **Chainlink**, **Nghiên AI**, **CTW SEVINA**, as well as representatives from Hung Vuong University Ho Chi Minh City, Van Hien University, and Gia Dinh University.

Their participation turned the workshop into a multi-sided ecosystem forum. Students did not only hear about technology trends; they also encountered perspectives from education, companies, developer communities, and partner institutions.

This is central to the UniHackFest model. The program is not only about finding ideas. It also creates an environment where students can learn how to ask better questions, connect with the right resources, and develop products with practical value.

## Two Deep Dives into AI Agents and Blockchain

Alongside the broader conversation about AI, Blockchain, and Web3, the ITC program featured two focused sharing sessions that helped students understand how AI Agents and blockchain are converging to shape the next generation of applications.

### Mai Thanh Nha: When AI Agents Need Trusted Infrastructure

![UniHackFest UniTour x ITC: Opening July with AI, Blockchain, and Web3](/blog/unihackfest-unitour-itc-ai-blockchain-web3-2026/10.jpg)

AI is advancing quickly, but a deeper question is emerging: what happens when AI can make decisions, make payments, and interact with digital systems on its own? In his session at UniHackFest UniTour x ITC, **Mai Thanh Nha** provided an overview of **AI Agents**, blockchain, and how the two technologies are beginning to work together in new application models.

The talk introduced key ideas including **Agentic AI, AI Agents, tokenization, Real World Assets (RWA), on-chain data**, and **micro-payments**. From there, students could see why blockchain is not only infrastructure for digital assets. It can also become a trust layer that helps AI operate with more transparency, verifiability, and autonomy in the digital economy.

This perspective is especially useful for students who are starting to build products in the AI era. As AI systems become capable of making decisions and taking action on behalf of users, questions around data, ownership, payments, verification, and trust will become core parts of product design.

### Jack Vi from Nghiên AI: From Chatbots to AI Workflows and a Second Brain

![UniHackFest UniTour x ITC: Opening July with AI, Blockchain, and Web3](/blog/unihackfest-unitour-itc-ai-blockchain-web3-2026/8.jpg)

Continuing the program, **Jack Vi** from the **Nghiên AI** community raised a practical question for students: what if AI is no longer just a chatbot opened when needed, but a system that can understand context, organize knowledge, and use applications on behalf of people?

His session introduced a practical framework built around five factors that directly shape AI output quality: **model, tool, prompt, context**, and **skill**. Context was highlighted as one of the most important yet often overlooked elements. Jack Vi suggested ways students can organize documents, notes, screenshots, research sources, and project knowledge into a system that different AI agents can work with.

The session also pointed to a major shift in how people interact with technology. Instead of manually opening each application and handling each task step by step, users will increasingly delegate work to AI agents: processing files, analyzing data, summarizing weekly learning content, creating slides, and completing digital workflows.

For students, this is a practical way to move beyond one-off prompting. By building a personal knowledge base and their own AI workflows, they can reduce hallucinations, learn more effectively, and prepare to build products with AI in a more systematic way.

## Learning About AI, Blockchain, Web3, and Smart Contracts

Through expert sharing sessions, ITC students updated their practical understanding of **AI, Blockchain, Web3, Digital Assets**, and **Smart Contracts**. These topics helped students move from isolated technologies toward a broader view of products and ecosystems.

AI offers new ways to automate workflows, support decisions, and build more intelligent user experiences. Blockchain and Smart Contracts help students understand how rules can be programmed, verified, and executed transparently on decentralized infrastructure. Digital Assets introduce a new layer of value, where ownership, transactions, and data can be represented through digital models.

When viewed together, these technologies open many product directions for students: education applications, finance tools, community governance, digital credentials, learning data, and business support solutions. This is also the spirit of UniHackFest 2026: learn to understand, build to validate, and present to receive feedback.

## A Bridge Between College, Companies, and Students

![UniHackFest UniTour x ITC: Opening July with AI, Blockchain, and Web3](/blog/unihackfest-unitour-itc-ai-blockchain-web3-2026/7.jpg)

The workshop was not only an academic forum. It also acted as a bridge between the college, companies, and students. For ITC, the program expanded connections with the technology ecosystem. For companies and experts, it created another channel to engage young talent. For students, it offered a clearer view of the skills they need to enter the digital era with confidence.

UniHackFest 2026 continues to support students through learning activities, mentoring, project development, and product showcases. From UniTour sessions such as the one at ITC, students can begin finding teammates, identifying problems worth solving, and preparing to turn ideas into real products.

## Ready for UniHackFest 2026

UniHackFest UniTour x ITC closed with strong momentum: students accessed new knowledge, the college and companies deepened their connection, and the technology ecosystem gained another opportunity to support young builders.

With the foundation built through the workshop, ITC students are better prepared to explore AI, Blockchain, and Web3 in greater depth and take on the challenge of UniHackFest 2026. Every question, idea, and connection made during UniTour can become the starting point for a valuable project in the future.

**Explore the roadmap and register at [unihackfest.vn](https://unihackfest.vn/?utm_source=corelia.academy&utm_medium=referral&utm_campaign=unihackfest_2026&utm_content=itc_unitour_recap).**
$md$),
('en', 'vietnam-rwa-summit-2026', 'vietnam-rwa-summit-2026', 'blog', 'published', $md$Vietnam RWA Summit 2026: When Real-World Assets Enter the Digital Age$md$, $md$Vietnam RWA Summit 2026 debuts in Hanoi: Vietnam’s first in-depth forum on Real World Assets, tokenization, policy, and infrastructure, hosted by the Vietnam Blockchain Association in late June 2026.$md$, 'terran', 'announcements-events', ARRAY['web3','ecosystem','blockchain-fundamentals','smart-contracts','career-tips']::text[], '{"type":"image","src":"/blog/vietnam-rwa-summit-2026.png","alt":"Illustration of real-world assets (RWA) and tokenization in Vietnam","fit":"cover"}'::jsonb, '2026-04-27'::date, '2026-04-27'::timestamptz, '2026-04-27'::timestamptz, $md$**Tokenization**, representing real-world assets on blockchain, is no longer a far-off idea. Globally, billions of dollars in real estate, bonds, gold, and other financial assets are being digitized every day. The question is no longer *whether* this trend will continue, but **how and when Vietnam will take part**.

To explore that, **Vietnam RWA Summit 2026 (VRS2026)** will make its debut in **Hanoi in late June 2026**, Vietnam’s first in-depth forum dedicated solely to **Real World Assets (RWA)**.

## What is RWA, and why does it matter?

**Real World Assets (RWAs)** are physical or traditional financial assets, from real estate and gold to government bonds and corporate loans, represented as digital tokens on a blockchain. This unlocks:

- **Fractional ownership:** A multi-million-dollar property can be split so thousands of investors can participate.
- **Greater liquidity:** Assets that are usually illiquid, such as land or art, can trade around the clock on global markets.
- **Transparency and automation:** Smart contracts can replace layers of intermediaries, cutting cost and operational risk.

According to reports from BlackRock, Boston Consulting Group, and other major institutions, the global RWA market could reach roughly **$16 trillion by 2030**.

## Where does Vietnam stand in this shift?

Vietnam has strong reasons to join the RWA wave: a fast-growing economy, an active real estate market, a vibrant tech community, and a rising cohort of digitally savvy young investors.

The challenges are real, too: legal frameworks for digital assets are still taking shape, infrastructure linking real assets to blockchains is early-stage, and market understanding of RWA still has gaps. That is why **a dedicated forum**, where policy, technology, and markets meet, is more important than ever.

## What will Vietnam RWA Summit 2026 be?

VRS2026 is **more than a conference**. It is a dialogue space for people who are actually building the future of finance in Vietnam:

- **Policymakers** who want a deeper view of digital-asset governance models that fit Vietnam.
- **Financial institutions and enterprises** looking to apply tokenization in their operations.
- **Technology and blockchain companies** building RWA market infrastructure.
- **Investors** who want early exposure to this new asset class.

Core questions the event will surface include:

- How can **real assets** be connected to digital infrastructure **safely and compliantly**?
- **Which models** fit Vietnam?
- **Who will lead** as first movers?

## Event information

- **Location:** Hanoi
- **Timing:** Late June 2026
- **Host:** Vietnam Blockchain Association (VBA)

Agenda details, speakers, and registration will be announced soon.

## A moment for Vietnam to make its mark

Every wave in financial technology has early movers and followers. For RWA, the window of opportunity is open, but it will not stay open forever.

**Vietnam RWA Summit 2026** is an open invitation to anyone who wants to learn, build, and lead in this space in Vietnam. A new chapter is about to begin.

Follow VBA for the latest on VRS2026. #VBA #VietnamRWASummit #RWA #VRS2026
$md$),
('en', 'web3-builders-hackathon-awards-at-itc-2026', 'trao-giai-hackathon-web3-builders-tai-itc-2026', 'blog', 'published', $md$Web3 Builders Hackathon Awards at ITC: Celebrating Outstanding Web3 Projects$md$, $md$The Web3 Builders Hackathon awards ceremony on May 15, 2026 recognized outstanding ITC student projects after a hands-on journey of learning, building, and presenting products on Sui Blockchain.$md$, 'corelia-team', 'career-ecosystem-insights', ARRAY['web3','move-language','dapp-development','project-based','hackathon','ecosystem']::text[], '{"type":"image","src":"/blog/corelia-itc-award-2026/corelia-itc-award.jpg","alt":"Web3 Builders Hackathon awards ceremony at ITC","fit":"cover"}'::jsonb, '2026-05-15'::date, '2026-05-15'::timestamptz, '2026-05-15'::timestamptz, $md$On **May 15, 2026**, the **“Web3 Engineer – Sui Blockchain”** program at ITC reached a memorable milestone with the closing and awards ceremony for the **“Web3 Builders” Hackathon**. The event celebrated the standout teams following a journey of learning, product development, and live Web3 project presentations before an evaluation panel.

Before the awards ceremony, [14 teams took the Demo Day stage](/blog/web3-engineer-sui-blockchain-demo-day-2026) to introduce projects built with the knowledge and skills they had developed throughout the program. From their first sessions with Sui Move, smart contracts, tokens, and dApps, students progressively transformed what they learned into products they could present and validate.

You can also revisit the full [Web3 Engineer training journey at ITC](/blog/corelia-launches-web3-engineer-training-program-at-itc-2026) to see how these young builders prepared for the “Web3 Builders” Hackathon.

## 1. From 14 Product Demos to the Award-Winning Teams

![Web3 Builders Hackathon awards ceremony at ITC](/blog/corelia-itc-award-2026/corelia-itc-award-1.jpg)

During the earlier project defense and Demo Day, **14 teams** demonstrated their products and presented their Web3 projects directly to the evaluation panel. Each team brought its own approach, showing an ability to apply technology, collaborate, and complete a product within a hands-on training program.

Reaching the Demo Day stage required more than writing code. Teams also had to identify a problem, align around an idea, divide responsibilities, connect smart contracts to an interface, and communicate the value of their product. The process called for persistence, adaptability, and accountability from every member.

The projects stood out to the evaluation panel in three key areas:

- **Creativity:** Reflected in the way teams formed ideas and approached problems with Web3 technology.
- **Practical applicability:** Demonstrated through efforts to place technology in specific contexts and address tangible needs.
- **A hands-on builder mindset:** Evident throughout the process of development, teamwork, problem-solving, and product demonstration.

The awards ceremony therefore recognized more than final outcomes. It also celebrated how far the students had progressed: from writing their first lines of code to defending a product before an evaluation panel.

## 2. “Web3 Builders” Hackathon Results

Following the evaluation process, the judging panel selected the outstanding teams of the “Web3 Builders” Hackathon. Each award marked the effort required to turn knowledge into a product and the willingness to test new skills in an emerging field of technology.

### Top 1: Sui Nexus Artillery – Class CD25CT-CLC

![Top 1 award presentation for Sui Nexus Artillery](/blog/corelia-itc-award-2026/corelia-itc-award-2.jpg)

The top position in the “Web3 Builders” Hackathon went to **Sui Nexus Artillery** from class **CD25CT-CLC**. The Top 1 result recognized the team's standout performance throughout the project development and presentation process.

### Top 2: Saigon Coffee Collective – Class CD25CT5

![Top 2 award presentation for Saigon Coffee Collective](/blog/corelia-itc-award-2026/corelia-itc-award-3.jpg)

The Top 2 award went to **Saigon Coffee Collective** from class **CD25CT5**. The result recognized the team's collaborative journey, product completion, and project presentation at Demo Day.

### Top 3: Fantastic Farm – Class CD25LM2

![Top 3 award presentation for Fantastic Farm](/blog/corelia-itc-award-2026/corelia-itc-award-4.jpg)

**Fantastic Farm** from class **CD25LM2** earned the Top 3 position. The team completed the Hackathon journey and made its mark during the project evaluation.

### Encouragement Awards

The two Encouragement Awards went to:

- **Sui Ticket** – Class **CD25CT6**

![Encouragement Award presentation for Sui Ticket](/blog/corelia-itc-award-2026/corelia-itc-award-5.jpg)

- **CV On-chain** – Class **CD25CT-CLC**

![Encouragement Award presentation for CV On-chain](/blog/corelia-itc-award-2026/corelia-itc-award-6.jpg)

The awards recognized both teams' efforts in developing their ideas, building their products, and completing live demonstrations before the panel.

## 3. Assets Auction Receives the Community Choice Award

![Community Choice award presentation for Assets Auction](/blog/corelia-itc-award-2026/corelia-itc-award-7.jpg)

Alongside the categories evaluated by the judging panel, **Assets Auction** was recognized with the **Community Choice** award. This category carries a distinct meaning because it reflects the attention and connection the project generated among the community following the program.

Community feedback is an important source of insight in any product-building journey. It helps builders understand how an idea is received, which aspects attract interest, and where a product could improve. Community Choice is therefore more than a title; it can motivate a team to keep listening to users and continue developing the project after the Hackathon.

## 4. Awards as Milestones, Not the Finish Line

Hackathons are often remembered through rankings and awards, but their most lasting value lies in the building process itself. Students experienced how to turn an idea into a product scope, connect technical components, work within time constraints, and persuade others through a concrete demonstration.

Each team left the program with an outcome it can continue to develop. A Demo Day product can become part of a portfolio, evidence of collaborative experience, or the starting point for further experiments with Sui Blockchain.

Even for teams outside the award list, completing a project and defending it before a panel remains an achievement worth recognizing. Every error encountered, scope adjustment made, piece of feedback received, and improvement delivered contributes to the mindset of a real builder.

## 5. Hands-on Practice – Real-world Building – Industry Connection

The program was **delivered by Corelia at ITC**, in coordination with the institution and with professional support from **Sui, CommandOSS, and blockchain experts**. Throughout the journey, the direction of **“Hands-on Practice – Real-world Building – Industry Connection”** was reflected in the way students learned new concepts, built products directly, and presented their work in an environment involving industry experts.

This model helps close the gap between the classroom and professional practice. Students did not approach Web3 only as a technology topic. They also learned how to collaborate, manage progress, solve problems, and communicate about a product: all essential capabilities in an industry setting.

The connection between the institution, program delivery team, and ecosystem also gave students a broader view of the pathways available to them. Starting from a program project, they can continue strengthening their portfolios, enter larger technology competitions, and actively pursue further opportunities in Web3.

## 6. One Journey Concludes as the Web3 Builders Move Forward

The awards ceremony on May 15, 2026 concluded a journey that was both challenging and memorable. From the classroom to the Hackathon, and from the first hands-on assignments to the Demo Day stage, ITC students demonstrated that knowledge creates its greatest value when translated into action and tangible products.

Congratulations to:

- **Top 1:** Sui Nexus Artillery – Class CD25CT-CLC
- **Top 2:** Saigon Coffee Collective – Class CD25CT5
- **Top 3:** Fantastic Farm – Class CD25LM2
- **Encouragement Award:** Sui Ticket – Class CD25CT6
- **Encouragement Award:** CV On-chain – Class CD25CT-CLC
- **Community Choice:** Assets Auction

Congratulations as well to all 14 teams for completing the “Web3 Builders” Hackathon. The products, experience, and connections created through the program will support them as they continue learning, experimenting, and becoming the Web3 Builders of the future.
$md$),
('en', 'web3-engineer-sui-blockchain-demo-day-2026', 'khep-lai-hanh-trinh-ky-su-web3-sui-blockchain-demo-day-2026', 'blog', 'published', $md$Web3 Engineer – Sui Blockchain Journey Concludes with 14 Teams at Demo Day$md$, $md$Session 5 of the Web3 Engineer – Sui Blockchain program at ITC concluded with the Web3 Builders Hackathon and Demo Day, featuring 14 teams and opening pathways to internships and an inter-university competition.$md$, 'corelia-team', 'career-ecosystem-insights', ARRAY['web3','move-language','dapp-development','project-based','hackathon','career-tips']::text[], '{"type":"image","src":"/blog/corelia-itc-demoday-2026/corelia-itc-demoday-1.png","alt":"Web3 Builders Demo Day with 14 teams at ITC","fit":"cover"}'::jsonb, '2026-05-13'::date, '2026-05-13'::timestamptz, '2026-05-13'::timestamptz, $md$The **“Web3 Engineer – Sui Blockchain”** journey at ITC officially concluded with an energetic fifth session featuring the **“Web3 Builders” Hackathon** and a project **Demo Day**. After weeks of learning, hands-on practice, and product development, 14 teams took the stage to present Web3 ideas and applications they had built themselves.

While the earlier sessions guided students from smart contracts with Sui Move and token creation to dApp interfaces and wallet integration, Demo Day brought all of those skills together in complete products. These were no longer isolated exercises. They reflected the technical thinking, collaboration, and hands-on builder mindset developed throughout the program.

Read more about the [Web3 Engineer training journey at ITC](/blog/corelia-launches-web3-engineer-training-program-at-itc-2026) to see how the teams prepared for this final Demo Day.

## 1. Session 5: The End of a Program and the Beginning of New Builders

![Web3 Builders Demo Day with 14 teams at ITC](/blog/corelia-itc-demoday-2026/corelia-itc-demoday-2.png)

Session 5 marked the most important milestone of the practical **“Web3 Engineer – Sui Blockchain”** program. Instead of continuing to absorb individual technical topics, students stepped into the role of builders. They had to define a problem, complete a solution, test their product, and present the outcome to an evaluation panel.

The final session combined two closely connected activities:

- The **“Web3 Builders” Hackathon** created a focused environment in which teams could develop and refine their products with a competitive spirit.
- The **project Demo Day** gave students a stage to explain their ideas, approaches, completed products, and the value their solutions aimed to deliver.

Bringing a hackathon and Demo Day together allowed students to experience a workflow closer to real product development. An idea becomes convincing only when a team can turn it into a working solution, clearly explain how it operates, and demonstrate its potential for further development.

## 2. Fourteen Teams Turn Ideas into Working Products

![Web3 Builders Demo Day with 14 teams at ITC](/blog/corelia-itc-demoday-2026/corelia-itc-demoday-3.png)

Following the learning and development process, **14 teams** arrived at Demo Day with creative Web3 ideas and applications. Each presentation represented multiple rounds of discussion, experimentation, coding, debugging, and product refinement within the program's limited timeframe.

Beyond technical knowledge, the teams demonstrated their ability to frame problems and organize their work. Moving from an initial idea to a demonstrable product required students to connect several capabilities:

- Identifying the problem and the users the product was designed to serve.
- Selecting core features that could realistically be delivered within the available scope.
- Building smart contract logic and handling data on Sui Blockchain.
- Developing a dApp interface through which users could interact with the product.
- Dividing responsibilities, coordinating progress, and resolving unexpected issues.
- Preparing a demo, communicating the idea, and responding to questions from the panel.

This process turned Demo Day into a tangible milestone for every participant. Students could do more than say they had studied Web3; they could present a product and explain the technical and product decisions behind it.

## 3. A Hands-on Builder Mindset on the Demo Day Stage

![Web3 Builders Demo Day with 14 teams at ITC](/blog/corelia-itc-demoday-2026/corelia-itc-demoday-4.png)

What made Demo Day stand out was not only the number of participating teams, but also the students' willingness to put their work to the test. For many participants, this was their first time presenting a Web3 product to industry experts and business representatives. The combined pressure of time, technical quality, and presentation required a much higher level of focus than a conventional classroom assignment.

In this environment, skills that might appear separate began to reinforce one another. Programming knowledge made the product work. Product thinking helped teams choose the right problem. Collaboration kept different workstreams moving in the same direction. Presentation skills made the solution's value understandable to others.

The builder mindset was also visible in how students handled constraints. Not every idea could deliver every planned feature in a single development cycle. Teams learned to prioritize, reduce scope, resolve issues, and produce a clear version that could be tested. This is an essential experience for anyone preparing to work in technology product development.

## 4. From Student Projects to Internship Opportunities

![Web3 Builders Demo Day with 14 teams at ITC](/blog/corelia-itc-demoday-2026/corelia-itc-demoday-6.png)

Demo Day was more than a course-closing activity. The students' products and performance also created a direct connection to the wider ecosystem and industry. Based on the assessment of their work and individual capabilities, **Sui will consider suitable students for participation in an internship program**.

This opportunity helps shorten the distance between education and employment. Instead of relying only on grades or a list of completed courses, students can demonstrate their capabilities through a working product, their contribution to a team, and the way they approach real problems.

A completed Web3 project also provides a valuable foundation for a student's portfolio. Teams can continue improving their products after the program, add new features, refine the user experience, or use the work as a starting point for future projects.

## 5. Six Outstanding Teams Advance to an Inter-University Competition

![Web3 Builders Demo Day with 14 teams at ITC](/blog/corelia-itc-demoday-2026/corelia-itc-demoday-7.png)

Following the project evaluation, the **six highest-performing teams** will be guided by the **Faculty of Information Technology and Electronics–Telecommunications** as they advance to an inter-university competition with students from other colleges and universities.

This next stage introduces a broader challenge. Teams will need to improve not only the technical quality of their products, but also the clarity of the problem, the solution's differentiation, and its potential for real-world use. Beyond the classroom, each project will be placed alongside ideas and approaches developed in different academic environments.

The inter-university competition is therefore more than another round of judging. It gives students a chance to engage with a wider builder community, learn from other products, and understand the standards they will need to meet if they want to progress further in Web3.

## 6. Value Beyond a Technology Course

![Web3 Builders Demo Day with 14 teams at ITC](/blog/corelia-itc-demoday-2026/corelia-itc-demoday-8.png)

“Web3 Engineer – Sui Blockchain” did more than introduce students to a modern technology trend. It provided a structured path from learning new concepts to building and presenting a product.

Throughout the journey, students had opportunities to:

- **Explore modern Web3 and blockchain technologies** through Sui and the Move language.
- **Learn and work directly with experts and industry partners**, gaining insight into real technology environments.
- **Build an actual product** rather than stopping at theoretical assignments or prepared examples.
- **Experience team-based product development**, from ideation and role allocation to implementation and demonstration.
- **Expand career opportunities** while still at university through products, portfolios, and ecosystem connections.

Most importantly, the program encouraged students to become proactive learners. Technology will continue to change, but the ability to learn independently, experiment, collaborate, and turn knowledge into concrete results will remain valuable throughout their careers.

## 7. Connecting Education, Program Delivery, and the Web3 Ecosystem

![Web3 Builders Demo Day with 14 teams at ITC](/blog/corelia-itc-demoday-2026/corelia-itc-demoday-9.png)

The program was **delivered by Corelia at ITC**, in coordination with the institution and with professional support from **Sui, CommandOSS, and blockchain experts**. The entire journey followed the direction of **“Hands-on Practice – Real-world Building – Industry Connection.”**

This collaboration kept the training closely connected to practical needs. ITC provided the academic foundation and learning environment; Corelia designed and delivered the hands-on journey; ecosystem partners and experts contributed technical perspectives, product experience, and opportunities for students to continue developing.

From the opening sessions to Demo Day, the goal was never to memorize as many terms as possible. It was to help students **build a product, explain their product, and be ready for the next step**.

## Conclusion

![Web3 Builders Demo Day with 14 teams at ITC](/blog/corelia-itc-demoday-2026/corelia-itc-demoday-12.png)

Congratulations to all **14 teams** for completing a challenging and memorable journey. Every product presented at Demo Day reflected persistence, teamwork, and a willingness to step outside familiar territory to explore a new field of technology.

Session 5 may have concluded the **“Web3 Engineer – Sui Blockchain”** program, but the journey of these young builders is only beginning. Internship opportunities, an inter-university competition, and further product development now lie ahead.

We look forward to seeing the teams at the inter-university stage, where their Web3 ideas will be tested, refined, and taken even further.
$md$),
('en', 'what-is-unihackfest-2026-uef-kickoff', 'unihackfest-2026-la-gi-kick-off-tai-uef', 'blog', 'published', $md$What Is UniHackFest 2026? The 14-Week Journey Kicks Off at UEF$md$, $md$UniHackFest 2026 is a student learning and competition program taking teams from market insight to real AI and Web3 products in 14 weeks, officially kicking off at UEF on June 15.$md$, 'corelia-team', 'announcements-events', ARRAY['web3','blockchain-fundamentals','dapp-development','ecosystem','project-based','hackathon']::text[], '{"type":"image","src":"/blog/unihackfest-2026-la-gi-kick-off-tai-uef/unihackfest-la-gi.jpg","alt":"UniHackFest 2026 Kick-off tại UEF","fit":"cover"}'::jsonb, '2026-06-14'::date, '2026-06-14'::timestamptz, '2026-06-14'::timestamptz, $md$**UniHackFest 2026** is a learning and competition program for university students in Vietnam, designed to take teams from a real-world problem to a demonstrable and pitch-ready AI and Web3 product in 14 weeks.

The program will officially **kick off on June 15, 2026, at the University of Economics and Finance, Ho Chi Minh City (UEF)**. The event also opens UniHackFest UniTour 2026, a two-month workshop series planned across 15 universities.

UniHackFest is co-organized by **Corelia Academy and UEF**, with **MEXC Ventures and Solana** as sponsors. Rather than beginning with competition pressure, the program follows a **learn-before-you-compete** model, giving students foundations in market insight, product thinking, and technology before the Qualification Round and Demo Day.

> **Update:** The Kick-off took place on June 15, 2026. Read [Corelia and UEF Launch UniHackFest UniTour 2026](/blog/corelia-uef-launch-unihackfest-unitour-2026) for the event recap.

<!-- IMAGE_SLOT: Replace this comment with: ![UniHackFest 2026 officially kicks off at UEF](/blog/IMAGE-NAME.jpg) -->

## From the Classroom to Real AI and Web3 Products

Students can access technology knowledge through courses, workshops, and online materials, but a substantial gap often remains between learning concepts and building a product.

UniHackFest is designed to close that gap. Across 14 weeks, students research problems, form ideas, develop MVPs, build on-chain products, and present results. Every stage produces a tangible output, making progress visible to both participants and mentors.

The journey welcomes multiple roles. Developers create programs, interfaces, and integrations. Designers shape usable experiences. Product/Business contributors research users and markets while building the pitch narrative. A strong product needs these capabilities to work together.

## The Learn-Before-You-Compete Model

UniHackFest includes five hands-on learning areas:

- **C1 Market Insight:** Research users, problems, and opportunity size; create a Market Memo.
- **C2 AI Product Building:** Turn insight into a focused AI Product MVP.
- **C3 Rust Survival Kit:** Build the required foundation through a Rust On-chain Lab.
- **C4 Solana Bootcamp:** Develop a Solana dApp on Devnet with wallet integration and Explorer proof.
- **C5 Pitching:** Complete a Pitch Deck and product Demo.

Together, these outputs create a complete progression: **Market Memo → AI Product MVP → Rust On-chain Lab → Solana dApp Devnet → Pitch Deck and Demo**.

## Two Competition Tracks

The **MEXC Ventures Product & Business Track** focuses on digital asset products, market research, opportunity sizing, and practical go-to-market strategy for Vietnam or Southeast Asia.

The **Solana Technical Build Track** focuses on a functional on-chain product on Solana Devnet, wallet and frontend integration, and verifiable Explorer transactions.

The tracks have different emphases but remain connected. Technical products need user understanding, while market ideas need a clear prototype.

## The 14-Week Journey

The program progresses through five stages:

1. **Official Kick-off:** Program, rules, timeline, and registration announcement.
2. **UniTour:** Campus workshops introducing AI, Web3, Solana, and product thinking.
3. **Bootcamp Learning:** Online and offline training across five learning areas.
4. **Qualification Round:** Prototype completion and pitching for places in the Final.
5. **Demo Day:** Final pitching, awards, mentorship, investor, and ecosystem connections.

## Program Scale and Student Benefits

UniHackFest 2026 is designed around:

- **15 participating universities** across its campus journey.
- **More than 2,000 students** reached by the program.
- **Five hands-on courses** covering market, product, technology, and pitching.
- **A total prize pool of USD 10,000**.
- **One free month of the Cora AI Student Plan** for participating students.

Beyond awards, every Market Memo, MVP, dApp, and Pitch Deck can become evidence of capability in a student's portfolio.

## Kick-off at UEF on June 15, 2026

UEF is UniHackFest's co-organizing university alongside Corelia Academy and will host both the Kick-off and the first UniTour stop.

- **Venue:** UEF – University of Economics and Finance, Ho Chi Minh City
- **Date:** June 15, 2026
- **Time:** 8:00 AM–11:30 AM
- **Topics:** UniHackFest overview, learning and competition tracks, AI, Web3, digital assets, open education, Solana, Panel Q&A, and networking

After UEF, the UniTour journey will continue to other universities. **Hung Vuong University, Ho Chi Minh City (DHV)** will be the second stop.

## Begin Your Builder Journey

Students do not need to be AI or Web3 experts before registering. UniHackFest is structured so participants can learn progressively, find teammates with complementary skills, and improve products through repeated feedback.

You can also register without an existing team; the team name is optional in the form. Begin with your strongest role and connect with Developers, Designers, or Product/Business contributors in the community.

UniHackFest 2026 is an invitation to move beyond classroom assignments, build a real product, and make your capabilities visible.

**Explore the program and register at [unihackfest.vn](https://unihackfest.vn/?utm_source=corelia.academy&utm_medium=referral&utm_campaign=unihackfest_2026&utm_content=program_announcement).**
$md$),
('en', 'why-corelia-co-organizes-unihackfest-2026', 'vi-sao-corelia-dong-to-chuc-unihackfest-2026', 'blog', 'published', $md$Why Is Corelia Co-organizing UniHackFest 2026?$md$, $md$Corelia Academy's perspective on UniHackFest's learn-before-you-compete model, its 14-week AI and Web3 product journey, and its mission to connect students with industry.$md$, 'corelia-team', 'announcements-events', ARRAY['web3','hackathon','project-based','ecosystem','mentorship','career-tips']::text[], '{"type":"image","src":"/blog/vi-sao-corelia-dong-to-chuc-unihackfest-2026/_DSC0898.jpg","alt":"Corelia Academy co-organizes UniHackFest 2026","fit":"cover"}'::jsonb, '2026-06-23'::date, '2026-06-23'::timestamptz, '2026-06-23'::timestamptz, $md$At Corelia Academy, we believe a student hackathon should not begin with a countdown and end immediately after the awards ceremony. Its greatest value should be found in the journey leading up to that moment: participants build solid foundations, understand a market, develop product thinking, work with technology, and learn how to present a solution that others can verify.

That is why Corelia Academy is co-organizing **UniHackFest 2026** with the **University of Economics and Finance, Ho Chi Minh City (UEF)**. The 14-week learning and competition program takes students from the classroom into the process of building, refining, and pitching real AI and Web3 products.

According to the [official UniHackFest website](https://unihackfest.vn/?utm_source=corelia.academy&utm_medium=referral&utm_campaign=unihackfest_2026&utm_content=organizer_story), the program aims to connect 15 universities, more than 2,000 students, five hands-on courses, and a total prize pool of USD 10,000. Behind those figures is an even more important question: how can every participating student make meaningful progress, even if they do not ultimately receive an award?

<!-- IMAGE_SLOT: Replace this comment with: ![Corelia Academy and UEF at the UniHackFest 2026 Kick-off](/blog/IMAGE-NAME.jpg) -->

## 1. Turning a Short Competition into a Capability-Building Journey

Traditional hackathons create high-energy environments where teams work intensively, develop products within a limited timeframe, and present their results to judges. For students who are new to AI, Web3, or product development, however, being expected to begin immediately with an ambitious idea can expose a substantial gap between aspiration and current capability.

UniHackFest is designed to close that gap. Rather than expecting participants to know everything from the beginning, the program divides the journey into stages with clear outputs. Students progress from market research to MVP development, strengthen their technical foundations, put products into a verifiable environment, and develop their pitching skills.

For Corelia, this approach reflects the principles of hands-on education:

- **Learn toward a concrete output**, not only a theoretical assessment.
- **Build capability layer by layer**, allowing beginners to enter while still giving experienced teams room to excel.
- **Receive feedback throughout development**, rather than only a final score at the end of the competition.
- **Connect knowledge to market context**, helping students understand why a product should be built.

A competition can identify a winner. A strong learning journey should create many more builders who can continue learning, working, and creating value after the competition ends.

## 2. “Learn Before You Compete” Is More Than a Slogan

The UniHackFest roadmap includes five hands-on learning areas: **Market Insight, AI Product Building, Rust Survival Kit, Solana Bootcamp, and Pitching**. Each addresses a capability that is often missing when students build a product for the first time.

### Market Insight: Start with a Real Problem

A strong product does not begin by choosing the most talked-about technology. It begins by understanding users, market context, and a problem worth solving. Market Insight helps teams avoid building something simply because they can, while introducing the foundations of opportunity sizing and go-to-market thinking.

### AI Product Building: Turn Insight into an MVP

Once the problem is clear, students need to translate it into a minimum viable product that can be tested. AI Product Building introduces prioritization: which feature is essential, which assumption should be validated first, and what role AI should play in the product experience.

### Rust and Solana: Move from an Idea to an On-chain Product

Rust Survival Kit and Solana Bootcamp form the technical layer of the journey. Students progressively explore programming, on-chain architecture, and dApp development on Solana Devnet. Their products should exist beyond a slide deck: teams work toward wallet integration, verifiable transactions, and Explorer proof.

### Pitching: Make the Created Value Clear

Pitching is not decoration added after the code is finished. It is the moment when a team demonstrates that it understands the problem, has made deliberate product choices, and can communicate value to users, judges, partners, or investors.

The five learning areas connect into a sequence of outputs: **Market Memo → AI Product MVP → Rust On-chain Lab → Solana dApp Devnet → Pitch Deck and Demo**. This is how “learn before you compete” becomes an actionable and assessable process.

<!-- IMAGE_SLOT: Replace this comment with: ![UniHackFest's five-course hands-on learning roadmap](/blog/IMAGE-NAME.jpg) -->

## 3. Why Corelia Chose to Co-organize UniHackFest

Corelia Academy works to bring technology education closer to the way products are built in practice. Co-organizing UniHackFest allows that mission to operate across universities, bringing together academic institutions, companies, technical experts, and ecosystem partners.

An organizer's role extends beyond scheduling events. It includes responsibility for the complete learning and competition experience:

- Building a roadmap so students know what to learn at each stage.
- Connecting training content directly to competition outputs.
- Giving participants access to mentor guidance and feedback.
- Bringing product standards and market expectations into the learning environment.
- Maintaining continuity from Kick-off and UniTour to Bootcamp, Qualification Round, and Demo Day.

UniHackFest is also a step forward in Corelia's long-term mission to develop builders who can connect **technology, product, and market**. Technical ability is essential, but teams create impact only when they understand users, collaborate effectively, and move solutions closer to real-world use.

## 4. UniTour: Bringing Opportunity Directly to Campus

The UniHackFest UniTour journey officially began at the **University of Economics and Finance, Ho Chi Minh City (UEF)**, the program's co-organizing university, on June 15, 2026. Following this opening event, **Hung Vuong University, Ho Chi Minh City (DHV)** became the second UniTour stop, continuing to bring AI and Web3 closer to students and helping them understand the path from learner to builder.

UniTour matters because students do not all begin with the same background. Some have written smart contracts before. Others are stronger in design, business, or communications. Many may simply be curious about how an on-chain product works.

Through its campus stops, the program demonstrates that a hackathon team benefits from several roles:

- A **Developer** creates the technical foundation and brings the product into a working environment.
- A **Designer** creates an experience that helps users understand and use the product.
- A **Product/Business** contributor researches the problem, defines the market, and connects the solution to practical demand.

This variety makes UniHackFest more than a competition for people who already understand blockchain. It is a journey in which students from different disciplines can find their place in a product team.

<!-- IMAGE_SLOT: Replace this comment with: ![Students at the UEF and Hung Vuong University HCMC UniTour events](/blog/IMAGE-NAME.jpg) -->

## 5. Connecting Universities, Industry, and the Ecosystem

An inter-university program creates lasting value when every participant contributes its strengths. Universities provide learning environments and an understanding of their students. Organizers design and operate the journey. Technology partners, companies, and mentors contribute practical standards, specialized feedback, and pathways for further development.

At UniHackFest 2026, **MEXC Ventures** and **Solana** participate as sponsors. The two competition tracks reflect two essential dimensions of a product:

- The **Product & Business Track** focuses on market research, opportunity sizing, and a practical go-to-market strategy.
- The **Technical Build Track** focuses on an on-chain Solana product, Devnet functionality, wallet integration, and verifiable transactions.

Bringing both directions into one journey sends a clear message: technology products require both the ability to build and a meaningful understanding of the market.

## 6. Success Is Not Measured Only by the Winning Team

Prizes motivate participants and recognize standout teams. From Corelia's perspective as a co-organizer, however, UniHackFest's success should be measured through a broader set of outcomes:

- Students can move from a problem to a demonstrable prototype.
- Teams learn how to divide roles and collaborate throughout development.
- Participants understand how to validate a product rather than merely describe an idea.
- Every individual gains a concrete output for their portfolio.
- Universities and companies can observe student capabilities through real products.
- Promising teams have opportunities to continue developing after Demo Day.

If, after 14 weeks, students better understand the roles they want to pursue, know how to start a project, and can confidently present something they have built, the program will have delivered value far beyond a leaderboard.

## 7. From Kick-off to Demo Day

The Kick-off and first UniTour stop at UEF, followed by the second stop at Hung Vuong University, Ho Chi Minh City, are only the beginning. Ahead are additional campus activities, Bootcamp Learning, the Qualification Round, and Demo Day, where teams will present products to mentors, judges, and ecosystem partners.

Corelia Academy will continue supporting the journey as an organizer and education partner, helping students maintain a clear progression from knowledge to product. We believe capability is not formed in one dramatic moment, but through repeated cycles of learning, building, feedback, and improvement.

UniHackFest 2026 is an invitation for students ready to move beyond classroom assignments and take part in a real building journey.

**Explore the roadmap and register at [unihackfest.vn](https://unihackfest.vn/?utm_source=corelia.academy&utm_medium=referral&utm_campaign=unihackfest_2026&utm_content=organizer_story_cta).**

<!-- IMAGE_SLOT: Replace this comment with: ![UniHackFest organizers, partners, and students](/blog/IMAGE-NAME.jpg) -->
$md$),
('vi', 'corelia-academy-dong-hanh-unihackfest-2026-hanoi-campus', 'corelia-academy-unihackfest-2026-hanoi-campus', 'blog', 'published', $md$Corelia Academy Đồng Hành Cùng UniHackfest 2026 Hanoi Campus, Tiếp Sức Thế Hệ Student Builders$md$, $md$Corelia Academy đồng hành với vai trò đối tác chiến lược tại UniHackfest 2026 Hanoi Campus, góp phần kết nối kiến thức, cố vấn và trải nghiệm xây dựng sản phẩm cho sinh viên.$md$, 'corelia-team', 'announcements-events', ARRAY['web3','ecosystem','mentorship','project-based','hackathon']::text[], '{"type":"image","src":"/blog/corelia-academy-dong-hanh-unihackfest-2026-hanoi-campus/IMG_2728.jpg","alt":"Corelia Academy đồng hành cùng UniHackfest 2026 Hanoi Campus","fit":"cover"}'::jsonb, '2026-07-24'::date, '2026-07-24'::timestamptz, '2026-07-24'::timestamptz, $md$Ngày **24/07/2026**, workshop **UniHackfest 2026 Hanoi Campus** diễn ra trong không khí học hỏi và kết nối sôi nổi, quy tụ đông đảo sinh viên yêu thích công nghệ tại Hà Nội. Đồng hành với vai trò **đối tác chiến lược**, Corelia Academy cùng các đơn vị trong hệ sinh thái góp phần tạo nên một không gian nơi sinh viên không chỉ tiếp cận kiến thức mới mà còn bắt đầu chuyển hóa những quan sát của mình thành ý tưởng sản phẩm.

Sự kiện là một chặng trong hành trình UniHackfest 2026, chương trình hướng đến việc phát triển thế hệ student builders thông qua học tập, thực hành, cố vấn và kết nối cộng đồng. Tại Hanoi Campus, tinh thần ấy được thể hiện rõ qua những phiên chia sẻ thực tiễn và Mini Ideation Workshop dành cho sinh viên.

## Mở rộng con đường phát triển cho student builders

![Corelia Academy Đồng Hành Cùng UniHackfest 2026 Hanoi Campus, Tiếp Sức Thế Hệ Student Builders](/blog/corelia-academy-dong-hanh-unihackfest-2026-hanoi-campus/IMG_2734.jpg)

Workshop giúp người tham dự khám phá bức tranh tổng quan về UniHackfest 2026, từ lộ trình chương trình và các learning track đến những cơ hội phát triển dự án trong các chặng tiếp theo. Sinh viên nhờ đó có thể hình dung rõ hơn quá trình đi từ việc nhận diện một vấn đề đến xây dựng và trình bày một giải pháp.

Đây cũng là cách tiếp cận mà Corelia Academy theo đuổi khi đồng hành cùng cộng đồng công nghệ: kết nối kiến thức với trải nghiệm thực hành, đưa người học đến gần hơn với chuyên gia và tạo điều kiện để năng lực được hình thành thông qua quá trình xây dựng thực tế.

Trong bức tranh chung đó, BK Fintech Hackday được giới thiệu như một sân chơi thường kỳ dành cho sinh viên quan tâm đến công nghệ, kinh tế số và đổi mới sáng tạo. Hoạt động hướng đến các giải pháp có khả năng ứng dụng vào bài toán của doanh nghiệp và xã hội, qua đó tạo thêm không gian để sinh viên thử nghiệm tư duy và phát triển ý tưởng.

## Công nghệ bắt đầu từ một bài toán thực tế

![Corelia Academy Đồng Hành Cùng UniHackfest 2026 Hanoi Campus, Tiếp Sức Thế Hệ Student Builders](/blog/corelia-academy-dong-hanh-unihackfest-2026-hanoi-campus/IMG_2764.jpg)

Các phiên chia sẻ tại chương trình mang đến nhiều góc nhìn thực tiễn về **AI, Blockchain, Web3** và hành trình phát triển sản phẩm. Người tham dự được gợi mở cách quan sát nhu cầu thị trường, lựa chọn vấn đề đáng giải quyết và nhìn nhận công nghệ như một công cụ tạo ra giá trị.

Những trao đổi từ diễn giả và các đơn vị đối tác đồng thời giúp sinh viên hiểu hơn về cách công nghệ mới đang tham gia vào nền kinh tế số. Bên cạnh kiến thức chuyên môn là những câu chuyện về cơ hội học tập, nghề nghiệp và phát triển dự án, giúp các bạn có thêm cơ sở để định hướng con đường của mình.

Đối với một student builder, năng lực kỹ thuật là cần thiết nhưng chưa đủ. Quá trình xây dựng còn đòi hỏi khả năng hiểu người dùng, kiểm tra giả định, làm việc cùng đồng đội và liên tục điều chỉnh giải pháp. Workshop đã đặt những yếu tố ấy vào cùng một hành trình trải nghiệm.

## Mini Ideation Workshop: nơi ý tưởng bắt đầu thành hình

![Corelia Academy Đồng Hành Cùng UniHackfest 2026 Hanoi Campus, Tiếp Sức Thế Hệ Student Builders](/blog/corelia-academy-dong-hanh-unihackfest-2026-hanoi-campus/IMG_2773.jpeg)

Thay vì chỉ lắng nghe, sinh viên trực tiếp tham gia **Mini Ideation Workshop** để thảo luận và hình thành những ý tưởng đầu tiên. Mỗi nhóm bắt đầu từ một vấn đề mình quan tâm, cùng phân tích bối cảnh, đối tượng cần phục vụ và hướng tiếp cận khả thi.

Ban Tổ chức, mentors và các chuyên gia đã đưa ra những góp ý giúp người tham gia nhìn lại giả định, làm rõ giá trị của giải pháp và tiếp tục phát triển ý tưởng theo hướng thực tế hơn. Đây là bước nhỏ nhưng quan trọng để sinh viên chuyển từ trạng thái tìm hiểu sang chủ động xây dựng.

Tinh thần **không chỉ học, mà còn bắt đầu xây dựng** cũng phản ánh giá trị cốt lõi của một môi trường học tập theo dự án: kiến thức được củng cố khi người học trực tiếp vận dụng, thử nghiệm và cải thiện sản phẩm qua phản hồi.

## Sức mạnh từ sự đồng hành của hệ sinh thái

![Corelia Academy Đồng Hành Cùng UniHackfest 2026 Hanoi Campus, Tiếp Sức Thế Hệ Student Builders](/blog/corelia-academy-dong-hanh-unihackfest-2026-hanoi-campus/IMG_2783.jpg)

UniHackfest 2026 Hanoi Campus được tạo nên bởi sự phối hợp của các đơn vị giáo dục, cộng đồng và doanh nghiệp công nghệ. Corelia Academy trân trọng sự đồng hành của:

- **Đơn vị tổ chức:** Viện Công nghệ và Kinh tế số - Đại học Bách khoa Hà Nội; Đoàn Thanh niên Đại học Bách khoa Hà Nội; BK Fintech Club - CLB Tài chính và Công nghệ Đại học Bách khoa Hà Nội; HIEC - CLB Sáng tạo & Khởi nghiệp HUST.
- **Đối tác công nghệ:** A-Star Group và AiPad Builder Ecosystem.
- **Đơn vị đồng hành:** Finxdemy - Đào tạo và Tư vấn Công nghệ.
- **Đối tác chiến lược:** Corelia Academy.
- **Nhà tài trợ:** MEXC Tiếng Việt và Solana Developers Vietnam.

Corelia Academy cũng gửi lời cảm ơn đến các bạn sinh viên, diễn giả, mentors và chuyên gia đã cùng tạo nên một ngày học hỏi, trao đổi và kết nối nhiều ý nghĩa.

## Tiếp tục đồng hành từ ý tưởng đến sản phẩm

![Corelia Academy Đồng Hành Cùng UniHackfest 2026 Hanoi Campus, Tiếp Sức Thế Hệ Student Builders](/blog/corelia-academy-dong-hanh-unihackfest-2026-hanoi-campus/IMG_2759.jpg)

Workshop tại Hanoi Campus đã khép lại, nhưng quá trình phát triển của những student builders chỉ vừa bắt đầu. Các ý tưởng được hình thành tại sự kiện sẽ cần tiếp tục được kiểm chứng, hoàn thiện và chuyển hóa thành những giải pháp có thể tạo ra tác động thực tế.

Trong vai trò đối tác chiến lược, Corelia Academy tiếp tục đồng hành cùng UniHackfest 2026 và cộng đồng, kết nối hoạt động đào tạo với cố vấn, thực hành và cơ hội phát triển dự án. Mục tiêu không chỉ là giúp sinh viên hiểu công nghệ, mà còn trao thêm công cụ và môi trường để các bạn tự tin xây dựng bằng công nghệ.

**Tìm hiểu hành trình và đăng ký ý tưởng tại [unihackfest.vn](https://unihackfest.vn/vi/?utm_source=corelia.academy&utm_medium=referral&utm_campaign=unihackfest_2026&utm_content=hanoi_campus_recap).**
$md$),
('vi', 'corelia-academy-rwa-tokenized-gold-hanoi-workshop-2026', 'rwa-tokenized-gold-hanoi-workshop-2026', 'blog', 'published', $md$Corelia Academy Tham Dự Hội Thảo Chuyên Sâu Về RWA Và Vàng Mã Hoá Tại Việt Nam$md$, $md$Founder Corelia Academy tham dự hội thảo về giải pháp mã hoá tài sản thực (RWA) và vàng mã hoá do Hiệp hội Blockchain và Tài sản số Việt Nam phối hợp BinGold, cập nhật góc nhìn thực tiễn cho chương trình đào tạo.$md$, 'terran', 'career-ecosystem-insights', ARRAY['web3','ecosystem','blockchain-fundamentals','smart-contracts','career-tips']::text[], '{"type":"image","src":"/blog/rwa-vang-ma-hoa-hanoi-2026.jpg","alt":"Thư mời tham dự hội thảo chuyên sâu từ Hiệp hội Blockchain và Tài sản số Việt Nam phối hợp cùng BinGold","fit":"contain","ogSrc":"/blog/og/rwa-vang-ma-hoa-hanoi-2026.jpg"}'::jsonb, '2026-04-04'::date, '2026-04-04'::timestamptz, '2026-04-04'::timestamptz, $md$Trong quá trình xây dựng giáo trình và đồng hành cùng các lập trình viên bước vào không gian Web3, Corelia Academy luôn nhấn mạnh một điều: **làm chủ công nghệ và các dòng code chỉ là nền tảng**. Khi thị trường ngày càng trưởng thành, đặc biệt với sự bùng nổ của xu hướng **RWA (Real World Assets: tài sản thực mã hoá)**, bức tranh toàn cảnh đã rẽ sang hướng đa chiều hơn rất nhiều.

Đối với đội ngũ phát triển, việc viết hay triển khai smart contract để “token hoá” tài sản hiện đã có những tiêu chuẩn và mẫu hình rõ ràng. Thách thức lớn hơn lại nằm ở chỗ hệ thống **tương tác với thế giới thực**: làm sao để các oracle truyền tải dữ liệu chính xác; khung pháp lý nào bảo vệ nhà đầu tư; và quan trọng nhất, cơ chế lưu ký: bảo chứng tài sản vật lý được vận hành thế nào để thuyết phục các định chế tài chính truyền thống?

Nhằm cập nhật kiến thức và góc nhìn thực tiễn nhất từ thị trường để đưa vào các chương trình đào tạo, **Founder của Corelia Academy** vinh dự nhận lời mời tham dự một hội thảo chuyên đề quy tụ đúng những bài toán trên, lấy **vàng** làm kênh thử nghiệm tiên phong.

![](/blog/rwa-vang-ma-hoa-hanoi-2026-thu-moi.jpg)

*Thư mời tham dự hội thảo chuyên sâu từ Hiệp hội Blockchain và Tài sản số Việt Nam phối hợp cùng BinGold.*

Lần tham dự này là cơ hội để Corelia Academy **lắng nghe và học hỏi** từ các chuyên gia đầu ngành trong tài chính, pháp lý và vận hành. Từ đó, chúng tôi hy vọng chuyển hoá thành những tư duy giải quyết vấn đề thực tế cho cộng đồng học viên vượt ra khỏi khuôn khổ của một môi trường lập trình thuần tuý.

## Thông tin sự kiện

- **Chủ đề:** Giải pháp mã hoá tài sản thực (RWA) và cơ hội phát triển vàng mã hoá tại Việt Nam  
- **Đơn vị tổ chức:** Hiệp hội Blockchain và Tài sản số Việt Nam phối hợp cùng BinGold  
- **Thời gian:** 13:30 – 16:30 | Thứ Ba, 07/04/2026  
- **Địa điểm:** Trụ sở Công ty 1Matrix, Tầng 16 Century Tower, Times City, Hà Nội
$md$),
('vi', 'corelia-academy-uef-strategic-mou-fit-career-day-2026', 'corelia-academy-uef-strategic-mou-fit-career-day-2026', 'blog', 'published', $md$Dấu Ấn Hợp Tác Chiến Lược Giữa Corelia Academy Và UEF: Khai Mở Hành Trình Thực Chiến Cho Thế Hệ Trẻ$md$, $md$Trong khuôn khổ FIT Career Day 2026, Corelia Academy và UEF chính thức ký kết MOU, mở ra cơ hội thực tập, đào tạo chuyên sâu và đồng hành cập nhật chương trình học sát với nhu cầu doanh nghiệp.$md$, 'terran', 'career-ecosystem-insights', ARRAY['ecosystem','mentorship','project-based','career-tips','web3']::text[], '{"type":"image","src":"/blog/UEF02310.jpg","alt":"Corelia Academy và UEF đồng hành mở ra hành trình thực chiến cho sinh viên tại FIT Career Day 2026","ogSrc":"/blog/og/UEF02310.jpg"}'::jsonb, '2026-03-16'::date, '2026-03-16'::timestamptz, '2026-03-16'::timestamptz, $md$Trong khuôn khổ **FIT Career Day 2026**, Corelia Academy và **Đại học Kinh tế - Tài chính TP.HCM (UEF)** đã chính thức ký kết **Biên bản ghi nhớ hợp tác (MOU)**, đánh dấu một cột mốc quan trọng trong hành trình kết nối giữa nhà trường và doanh nghiệp. Sự kiện không chỉ mở ra một mối quan hệ hợp tác chiến lược bền vững, mà còn tạo thêm nhiều cơ hội để sinh viên UEF tiếp cận môi trường học tập thực tế, nâng cao năng lực chuyên môn và sẵn sàng hơn cho thị trường lao động đang thay đổi từng ngày.

Bạn có thể xem thêm thông tin về ngày hội trong [bài đăng chính thức của UEF về FIT Career Day 2026](https://www.uef.edu.vn/tin-tuc-su-kien/khai-mac-fit-career-day-2026-ket-noi-sinh-vien-voi-gan-20-doanh-nghiep-cong-nghe-35307).

Với Corelia Academy, giáo dục không dừng lại ở việc truyền đạt kiến thức. Chúng tôi theo đuổi triết lý đào tạo thực chiến, nơi sinh viên được tiếp cận trực tiếp với tư duy sản phẩm, quy trình làm việc thật và kỳ vọng thật từ doanh nghiệp. Việc đồng hành cùng UEF chính là bước đi tiếp theo để đưa tinh thần ấy vào môi trường đại học một cách bài bản và lâu dài.

## 1. MOU chiến lược: Từ kết nối đến hành động cụ thể

![](/blog/UEF02300.jpg)

Lễ ký kết tại FIT Career Day 2026 là nền tảng để hai bên triển khai các hoạt động hợp tác thiết thực, thay vì chỉ dừng lại ở mức định hướng. Thông qua thỏa thuận này, Corelia Academy và UEF sẽ cùng xây dựng một hệ sinh thái phát triển năng lực cho sinh viên theo hướng sát với thực tế doanh nghiệp.

Trọng tâm của hợp tác không chỉ nằm ở việc mở rộng cơ hội học hỏi, mà còn ở việc giúp sinh viên có thêm điều kiện va chạm sớm với môi trường nghề nghiệp. Đây là yếu tố rất quan trọng để các bạn trẻ rút ngắn khoảng cách giữa lý thuyết trên giảng đường và yêu cầu thực tế của thị trường.

## 2. Mở ra hành trình thực tập và trải nghiệm thực chiến

![](/blog/UEF02371.jpg)

Một trong những điểm nhấn quan trọng của thỏa thuận lần này là cơ hội để sinh viên UEF được tham gia **thực tập thực tế dưới sự dẫn dắt của đội ngũ chuyên gia Corelia Academy**. Thay vì chỉ quan sát, các bạn sẽ có cơ hội tham gia vào môi trường làm việc có định hướng, được tiếp cận với tư duy giải quyết vấn đề, kỹ năng phối hợp và cách triển khai công việc theo tiêu chuẩn thực tế.

Mô hình này giúp sinh viên tích lũy kinh nghiệm sớm, hiểu rõ hơn năng lực của bản thân và có thêm lợi thế khi bước vào hành trình nghề nghiệp sau tốt nghiệp. Với Corelia, đây cũng là cách để chúng tôi góp phần nuôi dưỡng một thế hệ nhân lực trẻ không chỉ giỏi kiến thức, mà còn sẵn sàng hành động và tạo ra giá trị.

## 3. Đồng hành đào tạo chuyên sâu cùng nhà trường

![](/blog/UEF02237.jpg)

Bên cạnh hoạt động thực tập, Corelia Academy sẽ phối hợp cùng UEF trong các chương trình **đào tạo chuyên sâu**, bao gồm workshop, talkshow và những buổi chia sẻ trực tiếp từ đội ngũ chuyên gia. Đây sẽ là không gian để sinh viên tiếp cận gần hơn với các góc nhìn thực tế từ thị trường, cập nhật xu hướng mới và học hỏi từ những trải nghiệm triển khai dự án thực chiến.

Việc chuyên gia trực tiếp tham gia giảng dạy và chia sẻ không chỉ giúp nội dung trở nên sinh động hơn, mà còn tạo ra cầu nối rõ nét giữa học thuật và ứng dụng. Sinh viên không chỉ nghe về nghề nghiệp, mà còn được hiểu nghề đang vận hành như thế nào trong thực tế.

## 4. Cùng UEF cập nhật chương trình học sát nhu cầu doanh nghiệp

![](/blog/DSC02695.jpg)

Một giá trị dài hạn khác từ MOU này là vai trò **cố vấn chương trình** mà Corelia Academy sẽ đồng hành cùng UEF triển khai. Với kinh nghiệm làm việc trực tiếp cùng thị trường và đội ngũ trẻ, Corelia có cơ hội đóng góp vào việc cập nhật nội dung đào tạo theo hướng thiết thực hơn, giúp giáo trình bám sát nhu cầu tuyển dụng và xu hướng phát triển của doanh nghiệp.

Đây là một bước đi quan trọng trong bối cảnh nhiều sinh viên hiện nay vẫn đối mặt với khoảng trống giữa những gì được học và những gì doanh nghiệp thật sự cần. Khi chương trình đào tạo được cập nhật liên tục với góc nhìn từ thực tiễn, sinh viên sẽ có thêm lợi thế để thích nghi nhanh hơn, làm việc hiệu quả hơn và tự tin hơn trên con đường phát triển sự nghiệp.

## Hướng tới một thế hệ trẻ bản lĩnh và sẵn sàng bứt phá

![](/blog/DSC02573.jpg)

Sự hợp tác giữa Corelia Academy và UEF tại FIT Career Day 2026 không chỉ là một dấu mốc đẹp về mặt chiến lược, mà còn là cam kết chung cho mục tiêu phát triển nguồn nhân lực trẻ chất lượng cao. Từ thực tập, đào tạo chuyên sâu đến đồng hành cải tiến chương trình học, tất cả đều hướng về một đích đến: giúp sinh viên có cơ hội học thật, làm thật và trưởng thành thật.

Corelia Academy tin rằng khi nhà trường và doanh nghiệp cùng bắt tay đúng cách, sinh viên sẽ là những người được trao thêm nhiều cơ hội nhất. Và từ cột mốc hôm nay, một hành trình mới đã chính thức được mở ra cho thế hệ trẻ UEF: hành trình của trải nghiệm, thực chiến và bứt phá nghề nghiệp trong tương lai.
$md$),
('vi', 'corelia-academy-van-lang-web3-dapp-workshop-2026', 'van-lang-web3-dapp-workshop-2026', 'blog', 'published', $md$Nhìn lại sự kiện Web3 DApp Workshop tại Đại học Văn Lang: Khi Sinh Viên Trở Thành Thế Hệ Builder Mới$md$, $md$Corelia Academy và CommandOSS đồng tổ chức Web3 DApp Workshop tại Đại học Văn Lang (21/03/2026), mang đến góc nhìn nền tảng về tài sản số, lộ trình Web3, và tư duy sản xuất sản phẩm cho thế hệ builder trẻ.$md$, 'terran', 'career-ecosystem-insights', ARRAY['web3','blockchain-fundamentals','dapp-development','ecosystem','career-tips','project-based']::text[], '{"type":"image","src":"/blog/vlu21032026.jpg","alt":"Web3 DApp Workshop tại Đại học Văn Lang với Corelia Academy và CommandOSS","fit":"contain","ogSrc":"/blog/og/vlu21032026.jpg"}'::jsonb, '2026-03-21'::date, '2026-03-21'::timestamptz, '2026-03-21'::timestamptz, $md$Vào ngày **21/03/2026** vừa qua, hội trường **Đại học Văn Lang** đã trở nên nóng hơn bao giờ hết với sự kiện **Web3 DApp Workshop**. Đây là không gian giao lưu, học hỏi chuyên sâu được **đồng tổ chức bởi Corelia Academy và CommandOSS**, nhằm trang bị cho các bạn sinh viên những nền tảng vững chắc để tự tin bước vào kỷ nguyên phi tập trung.

![](/blog/vlu21032026-1.jpg)

Cùng nhìn lại những điểm nhấn đáng chú ý nhất từ hai phiên chia sẻ của các diễn giả khách mời.

## 1) Bức tranh Tài Sản Số & lộ trình Web3 cho người mới

![](/blog/vlu21032026-2.jpg)

Mở đầu chương trình, diễn giả **Terran Thái – Founder Corelia Academy** đã mang đến góc nhìn toàn cảnh về vị thế của Việt Nam trên bản đồ Blockchain thế giới. Với tỷ lệ chấp nhận tài sản mã hóa chạm mức **20% (Top 4 toàn cầu)** và hành lang pháp lý đang dần hoàn thiện, đây chính là “thời điểm vàng” để thế hệ trẻ nắm bắt cơ hội.

Một trong những khái niệm cốt lõi được nhấn mạnh là sự khác biệt giữa **tài sản truyền thống** và **tài sản số (Digital Assets)**. Trong Web3, quyền sở hữu được trả về tay người dùng thông qua mô hình **Self-custody** (tự lưu trữ bằng private key), đảm bảo tính minh bạch on-chain và khả năng giao dịch 24/7 trên toàn cầu không biên giới.

Để giúp các bạn sinh viên không bị “ngợp”, Corelia Academy đã giới thiệu **lộ trình 6 giai đoạn thực chiến**:

- **Foundation (Nhập môn)**: Nắm vững kiến thức nền về blockchain. Chọn ngách Tech hoặc Non-Tech.
- **Direction (Định hướng)**: Bắt đầu xây dựng “output thật” (deploy contract, làm case study...).
- **Execution (Thực hành)**: Tham gia Hackathon, làm việc cùng các team dự án.
- **Exposure (Tham gia hệ sinh thái)**: Đào sâu vào các mảng DeFi, NFT, RWA,...
- **Specialization (Chuyên sâu)**: Xây dựng portfolio cá nhân vững chắc.
- **Tạo giá trị**: Trở thành một builder thực thụ, đóng góp trực tiếp cho sự phát triển của ngành.

## 2) Tư duy “Sản xuất” & bản chất của Blockchain

![](/blog/vlu21032026-3.jpg)

Tiếp nối sức nóng của chương trình, diễn giả **Harry Phan – Software Engineer tại CommandOSS** đã giúp các bạn sinh viên công nghệ thông tin “giải ngố” kiến trúc Web3 bằng một phép so sánh trực quan: **“Blockchain trong Web3 đóng vai trò tương tự như Database trong Web2.”**

Thay vì phụ thuộc vào một máy chủ tập trung – nơi tiềm ẩn rủi ro về kiểm duyệt, tăng phí vô lý hay sập hệ thống (single point of failure), kiến trúc dApp và Smart Contract cho phép dữ liệu được lưu trữ phân tán. Các giao dịch được xác thực bằng chữ ký số và đóng gói thành các block có tính liên kết chặt chẽ, tạo nên một mạng lưới đồng thuận an toàn.

Đặc biệt, Harry đã truyền cảm hứng mạnh mẽ về tinh thần tham gia **Hackathon**. Khác với chuỗi giáo dục truyền thống kéo dài khoảng cách giữa “Học” và “Hành”, Hackathon là môi trường ép xung hoàn hảo. Tại đây, tư duy **“Sản xuất” (Production)** được đặt lên hàng đầu: mục tiêu của một builder không chỉ là học lý thuyết, mà là **tạo ra sản phẩm thực tế trong thời gian ngắn nhất**.

## Lời kết

![](/blog/vlu21032026-4.jpg)

Sự kiện Web3 DApp Workshop tại Đại học Văn Lang đã khép lại, nhưng hành trình khám phá thế giới phi tập trung của các bạn sinh viên chỉ mới vừa bắt đầu. Sự hào hứng, những câu hỏi sắc bén và tinh thần sẵn sàng học hỏi của các bạn chính là minh chứng rõ ràng nhất cho một thế hệ **“Web3 Builder”** đầy tiềm năng của Việt Nam trong tương lai.

Bạn đã sẵn sàng để viết tiếp câu chuyện của riêng mình trong không gian Web3?
👉 Tham gia ngay hệ sinh thái học tập và thực hành tại: https://app.corelia.academy
$md$),
('vi', 'corelia-stellar-apac-hackathon-vietnam-demo-day-2026', 'corelia-stellar-apac-hackathon-vietnam-demo-day-2026', 'blog', 'published', $md$Vietnam Demo Day 2026: Corelia đồng hành cùng Stellar APAC Hackathon$md$, $md$Ngày 18/07/2026, Vietnam Demo Day của Stellar APAC Hackathon quy tụ hơn 150 người tham dự, 75 bài dự thi và 60 dự án pitching, với sự hỗ trợ của Corelia Academy tại Việt Nam.$md$, 'corelia-team', 'announcements-events', ARRAY['web3','ecosystem','mentorship','hackathon','dapp-development']::text[], '{"type":"image","src":"/blog/corelia-stellar-apac-hackathon-vietnam-demo-day-2026/SHJ_4139.jpg","alt":"Các builder và ban tổ chức tại Stellar APAC Demo Day Việt Nam","fit":"cover"}'::jsonb, '2026-07-18'::date, '2026-07-18'::timestamptz, '2026-07-18'::timestamptz, $md$Ngày **18/07/2026**, ba sự kiện Demo Day đồng thời diễn ra tại **Việt Nam, Indonesia và Philippines**. Mỗi địa điểm có một không gian và nguồn năng lượng riêng, nhưng tất cả cùng kể chung một câu chuyện: đây là hackathon về Stellar có quy mô lớn nhất từng được tổ chức tại khu vực APAC.

Việc tổ chức ba Demo Day trong cùng một ngày là một lựa chọn có chủ đích. Chương trình không xem Demo Day là điểm kết thúc, mà là bước khởi đầu để tìm kiếm những founder có tiềm năng đồng hành lâu dài và biến một cuộc thi hackathon thành pipeline builder bền vững. Tại Việt Nam, sân khấu là nơi các đội trình bày thành quả sau nhiều tuần biến ý tưởng ban đầu thành sản phẩm có thể hoạt động.

**APAC Stellar Hackathon** được triển khai bởi **Rise In cùng Stellar Development Foundation**. Tại Việt Nam, **Corelia Academy tham gia với vai trò đối tác hỗ trợ**, góp phần kết nối builder, mentor, đối tác hệ sinh thái và cộng đồng công nghệ trong nước.

## Những con số tại Vietnam Demo Day

Vietnam Demo Day ghi nhận sự tham gia mạnh mẽ từ cộng đồng builder trong nước:

- **Hơn 150 người tham dự**, gồm builder, mentor, đối tác hệ sinh thái và thành viên cộng đồng
- **75 dự án được gửi về** từ nhiều nơi trên cả nước
- **60 dự án pitching** trong hai phiên sáng và chiều
- **4 giám khảo**, trong đó có 2 giám khảo bên ngoài đến từ Chainlink và Spartan
- **Top 10 dự án được lựa chọn** để tiến vào APAC Grand Finale

Những con số trên mới chỉ phản ánh một phần giá trị của sự kiện. Việc theo dõi 60 dự án qua hai phiên pitching giúp hội đồng giám khảo và các đối tác hệ sinh thái hiểu rõ hơn không chỉ sản phẩm mà các đội đã xây dựng, mà còn cả cách họ tiếp cận vấn đề, phản hồi câu hỏi và suy nghĩ về bước phát triển tiếp theo.

Tại thời điểm đó, Top 10 Việt Nam tiếp tục chuẩn bị để gặp các đội nổi bật từ Indonesia và Philippines tại **APAC Grand Finale ngày 31/07/2026**, hướng đến chiến thắng trong khuôn khổ **tổng giải thưởng 60.000 USD** của toàn chương trình.

## Hành trình đến Demo Day

![Một đội trình bày sản phẩm tại Stellar APAC Demo Day Việt Nam](/blog/corelia-stellar-apac-hackathon-vietnam-demo-day-2026/SHJ_3763.jpg)

Khi nhìn vào một Demo Day, người xem thường chỉ thấy năm phút cuối cùng trên sân khấu. Trên thực tế, phần quan trọng nhất của hành trình đã diễn ra trong nhiều tuần trước đó.

Tại Việt Nam, Indonesia và Philippines, hackathon được triển khai như một chương trình phát triển builder toàn diện. Hành trình bao gồm workshop dành cho developer, meetup cộng đồng, hoạt động tại các trường đại học và những sự kiện trực tuyến mở cho builder trên khắp APAC. Trong suốt quá trình, các founder liên tục nhận được hỗ trợ, đối mặt với những thử thách về kỹ thuật và sản phẩm, đồng thời cải thiện hướng đi của dự án.

Đề bài được xây dựng với yêu cầu cao: các đội cần phát triển **ứng dụng tài chính có thể hoạt động và có giao diện dành cho người dùng**, mang lại giá trị thực tế cho những nhu cầu cụ thể. Các sản phẩm trải rộng từ thanh toán đến những công cụ tài chính hằng ngày mà người dùng Đông Nam Á thực sự cần. Tiêu chí không chỉ là sản phẩm có sử dụng blockchain hay không, mà quan trọng hơn là liệu nó có giải quyết một vấn đề đủ thiết thực để người dùng lựa chọn sử dụng.

Trước khi bước lên sân khấu, mỗi đội đã phải hoàn thành những phần việc khó nhất: biến một quan sát ban đầu thành định hướng sản phẩm rõ ràng, xây dựng ứng dụng từ con số không và chuẩn bị một phần trình bày có thể truyền tải đồng thời giá trị sản phẩm lẫn năng lực triển khai kỹ thuật.

## Không chỉ là xếp hạng dự án

Vietnam Demo Day được thiết kế để làm nhiều hơn việc chấm điểm và xếp hạng. Các phiên pitching trực tiếp cùng phần hỏi đáp mang đến góc nhìn sâu hơn về cộng đồng builder so với những gì một biểu mẫu dự thi có thể thể hiện.

Quá trình đánh giá giúp chương trình:

- nhận diện các founder tiềm năng có định hướng xây dựng lâu dài trên Stellar
- đánh giá chất lượng sản phẩm và năng lực triển khai kỹ thuật trước Grand Finale
- hiểu rõ động lực, khó khăn và nhu cầu hỗ trợ tiếp theo của builder Việt Nam
- xây dựng quan hệ với các đội triển vọng cho những cơ hội về grant, mentorship, kết nối hệ sinh thái và triển khai mainnet
- tạo pipeline builder bền vững để hành trình có thể tiếp tục sau hackathon

Góc nhìn dài hạn này đặc biệt quan trọng. Một prototype triển vọng có thể là điểm bắt đầu của sản phẩm, nhưng để đi xa hơn, đội ngũ thường cần thêm phản hồi, hỗ trợ kỹ thuật, kết nối phù hợp và cơ hội kiểm chứng ý tưởng với người dùng thực tế.

## Vai trò của Corelia trong cộng đồng builder Việt Nam

Với vai trò đối tác hỗ trợ tại địa phương, **Corelia Academy góp phần kết nối chương trình với cộng đồng builder và công nghệ tại Việt Nam**. Hoạt động này phù hợp với định hướng lâu dài của Corelia: đưa cơ hội học tập thực tiễn, mentorship và khả năng tiếp cận hệ sinh thái đến gần hơn với các builder trẻ.

Với Corelia, một sự kiện chỉ tạo ra giá trị lâu dài khi người tham gia nhận được nhiều hơn một thứ hạng. Builder cần rời chương trình với định hướng sản phẩm rõ ràng hơn, những mối quan hệ chất lượng, phản hồi hữu ích và con đường để tiếp tục phát triển điều mình đã bắt đầu. Vietnam Demo Day tạo ra môi trường đó khi đưa các đội vào những cuộc trao đổi trực tiếp với giám khảo, mentor và đại diện hệ sinh thái.

Hai phiên pitching trọn vẹn cũng cho thấy chiều sâu của cộng đồng builder Việt Nam. Bên cạnh năng lực kỹ thuật, các đội thể hiện tư duy sản phẩm, sự bền bỉ và cam kết nghiêm túc với hành trình xây dựng lâu dài. Đây là nền tảng cho một pipeline chất lượng hướng đến Grand Finale và những chương trình hệ sinh thái tiếp theo.

## Từ Demo Day đến một hành trình dài hơn

Vietnam Demo Day là một cột mốc quan trọng, nhưng chưa bao giờ được xem là điểm kết thúc. Top 10 bước tiếp với sản phẩm đã có thể hoạt động, câu chuyện rõ ràng hơn và những phản hồi trực tiếp để tiếp tục hoàn thiện phần trình bày của mình.

Corelia Academy trân trọng cơ hội được hỗ trợ chương trình tại Việt Nam và đồng hành cùng các builder, mentor, giám khảo cùng đối tác hệ sinh thái đã góp phần tạo nên sự kiện. Nguồn năng lượng ngày 18/07 cho thấy điều có thể xảy ra khi một hackathon không chỉ là cuộc thi diễn ra một lần, mà trở thành cánh cửa dẫn đến hành trình học hỏi, xây dựng và đóng góp lâu dài cho hệ sinh thái Stellar.
$md$),
('vi', 'corelia-trien-khai-chuong-trinh-dao-tao-ky-su-web3-tai-itc-2026', 'corelia-trien-khai-chuong-trinh-dao-tao-ky-su-web3-tai-itc-2026', 'blog', 'published', $md$Corelia Triển Khai Chương Trình Đào Tạo Kỹ Sư Web3 Tại ITC: Học Thật, Làm Thật, Xây Sản Phẩm Thật$md$, $md$Chương trình đào tạo kỹ sư Web3 do Corelia triển khai tại ITC đưa sinh viên từ lập trình Smart Contract bằng Sui Move, tạo Token đến xây dựng dApp và chuẩn bị tham gia Hackathon Web3 Builders.$md$, 'corelia-team', 'career-ecosystem-insights', ARRAY['web3','smart-contracts','move-language','dapp-development','project-based','hackathon']::text[], '{"type":"image","src":"/blog/corelia-itc-training-2026/corelia-itc-training-2.jpg","alt":"Chương trình đào tạo Kỹ sư Web3 tại ITC","fit":"cover"}'::jsonb, '2026-04-29'::date, '2026-04-29'::timestamptz, '2026-04-29'::timestamptz, $md$Sinh viên **ITC** đang chính thức bước vào thế giới Web3 qua chương trình đào tạo kỹ sư Web3 do **Corelia triển khai**, được thiết kế theo tinh thần **“Học thật – Làm thật – Xây sản phẩm thật”**. Trong chuỗi buổi học chuyên sâu từ **Buổi 2 đến Buổi 4**, Blockchain không còn dừng lại ở những khái niệm trên slide, mà trở thành công nghệ để sinh viên trực tiếp viết code, tạo tài sản số, xây dựng ứng dụng và giải quyết các bài toán thực tế.

Chương trình không đặt mục tiêu biến người học thành chuyên gia chỉ sau vài buổi. Thay vào đó, sinh viên được xây dựng nền tảng đúng, thực hành từng bước và hiểu cách một sản phẩm Web3 được hình thành: từ Smart Contract ở lớp on-chain đến giao diện mà người dùng có thể tương tác trên trình duyệt.

## 1. Khi Blockchain Không Còn Chỉ Là Lý Thuyết
![Toàn cảnh lớp học Kỹ sư Web3 tại ITC](/blog/corelia-itc-training-2026/corelia-itc-training-3.jpg)

Với nhiều sinh viên công nghệ thông tin, những thuật ngữ như Blockchain, Smart Contract, Token hay dApp có thể đã quen thuộc qua tin tức và mạng xã hội. Tuy nhiên, khoảng cách giữa “đã nghe qua” và “có thể tự xây dựng” vẫn còn rất lớn.

Corelia triển khai chuỗi đào tạo tại ITC nhằm thu hẹp khoảng cách đó. Mỗi nội dung đều gắn với một đầu ra thực hành cụ thể: sinh viên không chỉ tìm hiểu Smart Contract là gì, mà còn trực tiếp lập trình và triển khai; không chỉ nghe về Token, mà tự tạo Token; không chỉ phân tích một dApp, mà từng bước xây dựng giao diện, kết nối ví và đưa dữ liệu Blockchain lên web.

Qua cách học này, người học có thể nhìn thấy mối liên hệ giữa các thành phần của một ứng dụng Web3 hoàn chỉnh:

- **Smart Contract** đảm nhiệm logic và quy tắc vận hành trên Blockchain.
- **Tài sản số** được biểu diễn, quản lý và chuyển giao theo các điều kiện minh bạch.
- **Ví Web3** giúp người dùng xác thực danh tính và ký giao dịch.
- **Giao diện dApp** tạo nên trải nghiệm trực quan, giúp người dùng tương tác với dữ liệu on-chain dễ dàng hơn.

Đây cũng là bước chuyển quan trọng trong tư duy học tập: từ ghi nhớ khái niệm sang hiểu hệ thống, từ làm theo hướng dẫn sang có khả năng phát triển một sản phẩm của riêng mình.

## 2. Lập Trình Smart Contract Với Sui Move

![Sinh viên ITC thực hành lập trình Sui Move](/blog/corelia-itc-training-2026/corelia-itc-training-4.jpg)

Một trong những nội dung trọng tâm của chương trình là lập trình Smart Contract với **Sui Move**. Sinh viên được tiếp cận cách mô hình hóa tài sản số, xây dựng logic giao dịch và tìm hiểu cách dữ liệu được quản lý trong môi trường Blockchain.

Thay vì xem tài sản số như một con số được lưu trong cơ sở dữ liệu tập trung, người học được làm quen với cách Sui Move biểu diễn tài sản dưới dạng các đối tượng có chủ sở hữu, thuộc tính và quy tắc tương tác rõ ràng. Qua đó, sinh viên hiểu sâu hơn về quyền sở hữu số, tính minh bạch và vai trò của Smart Contract trong việc bảo đảm các quy tắc được thực thi nhất quán.

Quá trình viết và kiểm tra Smart Contract cũng giúp sinh viên rèn luyện tư duy lập trình chặt chẽ. Mỗi thay đổi trạng thái, mỗi điều kiện truy cập và mỗi thao tác với tài sản đều cần được thiết kế có chủ đích. Đây là nền tảng quan trọng để các bạn tiếp tục khám phá những ứng dụng Web3 phức tạp hơn trong tương lai.

## 3. Tự Tạo Token Và Hiểu Cơ Chế Vận Hành Tài Sản Số

![Sinh viên ITC thực hành lập trình Sui Move](/blog/corelia-itc-training-2026/corelia-itc-training-6.jpg)

Sau khi làm quen với Smart Contract, sinh viên tiếp tục thực hành **tạo Token**. Hoạt động này giúp khái niệm tiền mã hóa và tài sản số trở nên cụ thể hơn: một Token không đơn thuần là một cái tên hay biểu tượng, mà là tập hợp các quy tắc được lập trình để xác định cách tài sản được tạo ra, lưu thông và sử dụng.

Thông qua bài thực hành, sinh viên từng bước tìm hiểu các thành phần quan trọng như:

- Cách khai báo và khởi tạo một loại tài sản số.
- Cơ chế phát hành, sở hữu và chuyển Token giữa các địa chỉ ví.
- Vai trò của Smart Contract trong việc kiểm soát nguồn cung và quyền thao tác.
- Cách dữ liệu giao dịch được ghi nhận, xác thực và hiển thị trên Blockchain.

Quan trọng hơn, sinh viên bắt đầu nhìn thấy Token dưới góc độ một thành phần của sản phẩm. Tùy vào bài toán, Token có thể đại diện cho quyền truy cập, điểm thưởng, tài sản trong trò chơi, chứng nhận hoặc nhiều loại giá trị số khác. Tư duy này mở ra không gian sáng tạo lớn hơn so với việc chỉ nhìn Token qua lăng kính giao dịch.

## 4. Xây Dựng Giao Diện dApp Và Kết Nối Ví

![Sinh viên ITC thực hành lập trình Sui Move](/blog/corelia-itc-training-2026/corelia-itc-training-5.jpg)

Một Smart Contract chỉ thực sự trở thành sản phẩm khi người dùng có thể tương tác với nó. Vì vậy, chương trình tiếp tục đưa sinh viên đến lớp ứng dụng với nội dung **xây dựng giao diện dApp, kết nối ví và hiển thị dữ liệu trên web**.

Ở giai đoạn này, kiến thức phát triển web quen thuộc được nối với hạ tầng Blockchain. Sinh viên học cách để giao diện nhận biết ví của người dùng, gửi yêu cầu tương tác đến Smart Contract và phản ánh kết quả giao dịch lên màn hình. Những thao tác như kết nối ví, đọc dữ liệu on-chain hay hiển thị tài sản sở hữu giúp các bạn hình dung rõ quy trình vận hành của một dApp từ đầu đến cuối.

Đây là cột mốc đáng chú ý trong hành trình học: sản phẩm không còn là những đoạn code rời rạc, mà bắt đầu có hình hài, có luồng tương tác và có thể được trình diễn cho người khác trải nghiệm.

<!-- IMAGE_SLOT: Thay comment này bằng: ![Sinh viên xây dựng giao diện dApp và kết nối ví](/blog/TEN-ANH.jpg) -->

## 5. Từ Bài Tập Cá Nhân Đến Tư Duy Xây Sản Phẩm Theo Nhóm

Bên cạnh năng lực kỹ thuật, chương trình chú trọng kỹ năng làm việc nhóm và tư duy sản phẩm. Sinh viên cùng nhau phát triển ý tưởng, xác định vấn đề muốn giải quyết, phân chia vai trò và chuẩn bị cho giai đoạn Hackathon.

Trong một nhóm xây dựng Web3, mỗi thành viên có thể đảm nhiệm một phần khác nhau: Smart Contract, giao diện, thiết kế trải nghiệm, nghiên cứu người dùng, thuyết trình hoặc điều phối tiến độ. Việc phối hợp giữa các vai trò giúp sinh viên hiểu rằng một sản phẩm tốt không chỉ cần code chạy được, mà còn phải giải quyết một nhu cầu rõ ràng và có cách trình bày thuyết phục.

Quá trình làm việc nhóm cũng tạo cơ hội để các bạn rèn luyện những năng lực thiết yếu của môi trường công nghệ thực tế:

- Chuyển một ý tưởng ban đầu thành phạm vi sản phẩm có thể triển khai.
- Phân chia công việc dựa trên thế mạnh của từng thành viên.
- Kết nối các phần Smart Contract, dữ liệu và giao diện thành một luồng hoàn chỉnh.
- Kiểm thử, nhận phản hồi và cải tiến sản phẩm trong thời gian giới hạn.
- Chuẩn bị phần demo và truyền đạt giá trị của giải pháp một cách rõ ràng.

## 6. Người Mới Cũng Có Thể Bắt Đầu Với Web3

Một điểm nổi bật của chương trình là **không yêu cầu sinh viên phải có nền tảng Web3 từ trước**. Lộ trình được xây dựng theo từng lớp kiến thức, giúp người học bắt đầu từ những nguyên lý cốt lõi trước khi tiến đến các bài thực hành phức tạp hơn.

Thay vì tạo áp lực phải biết mọi khái niệm ngay từ đầu, chương trình khuyến khích sinh viên học bằng cách thử nghiệm: viết những dòng code đầu tiên, gặp lỗi, tìm nguyên nhân, sửa lỗi và quan sát kết quả. Chính vòng lặp này giúp kiến thức trở nên bền vững và nuôi dưỡng sự tự tin của một builder.

Sinh viên còn được học trực tiếp cùng các chuyên gia đến từ **Corelia, Sui và CommandOSS**, qua đó tiếp cận cả kiến thức nền tảng, kinh nghiệm phát triển sản phẩm và góc nhìn thực tế từ hệ sinh thái Blockchain. Sự đồng hành này giúp người học có định hướng rõ ràng hơn: học nội dung gì, thực hành ra sao và cần chuẩn bị những kỹ năng nào để tiến xa hơn trong lĩnh vực Web3.

## 7. Hướng Đến Hackathon Web3 Builders: Nơi Ý Tưởng Trở Thành Sản Phẩm

Chuỗi buổi học không phải là đích đến cuối cùng. Trong giai đoạn tiếp theo, sinh viên sẽ bước vào môi trường “thực chiến” tại doanh nghiệp thông qua **Hackathon Web3 Builders**: nơi các nhóm vận dụng toàn bộ kiến thức đã học để biến ý tưởng thành sản phẩm có thể demo trực tiếp.

Hackathon là phép thử toàn diện cho cả kỹ thuật, tư duy sản phẩm và khả năng phối hợp. Trong thời gian giới hạn, sinh viên phải xác định bài toán, lựa chọn tính năng cốt lõi, xây dựng Smart Contract, hoàn thiện giao diện và chuẩn bị phần trình bày. Áp lực thời gian khiến các nhóm học cách ưu tiên điều quan trọng, ra quyết định nhanh và liên tục cải tiến dựa trên phản hồi.

Giá trị lớn nhất của chặng đường này không chỉ nằm ở kết quả thi đấu. Mỗi sản phẩm hoàn thành sẽ trở thành một dấu mốc năng lực cụ thể, giúp sinh viên xây dựng portfolio, hiểu quy trình phát triển sản phẩm và tự tin hơn khi bước vào môi trường nghề nghiệp.

<!-- IMAGE_SLOT: Thay comment này bằng: ![Các nhóm sinh viên chuẩn bị cho Hackathon Web3 Builders](/blog/TEN-ANH.jpg) -->

## 8. Sự Kết Nối Giữa Nhà Trường, Chuyên Gia Và Hệ Sinh Thái

Chương trình do **Corelia triển khai tại ITC**, với sự phối hợp của nhà trường và sự đồng hành chuyên môn từ **Sui, CommandOSS cùng các chuyên gia trong lĩnh vực Blockchain**. Mô hình này kết nối kiến thức tại nhà trường, kinh nghiệm triển khai từ đội ngũ công nghệ và cơ hội thực hành trong hệ sinh thái Web3.

Thông qua chuỗi hoạt động, sinh viên không chỉ được tiếp cận một công nghệ mới, mà còn được đặt vào đúng bối cảnh để phát triển năng lực: có lộ trình học tập, có người hướng dẫn, có đồng đội và có mục tiêu sản phẩm rõ ràng.

## Lời Kết

![Sinh viên ITC thực hành lập trình Sui Move](/blog/corelia-itc-training-2026/corelia-itc-training-1.jpg)

Từ lập trình Smart Contract bằng Sui Move, tự tạo Token đến xây dựng giao diện dApp và kết nối ví, sinh viên ITC đang từng bước làm chủ quy trình phát triển một ứng dụng Web3. Mỗi buổi học là một bước tiến từ kiến thức đến kỹ năng, từ ý tưởng đến sản phẩm và từ người học đến builder.

Chặng đường phía trước tại **Hackathon Web3 Builders** sẽ là lúc những gì sinh viên đã học được kiểm chứng trong môi trường thực tế. Những ý tưởng còn nằm trên giấy sẽ được viết thành code, hoàn thiện thành sản phẩm và trình diễn trước cộng đồng.

Hành trình kỹ sư Web3 tại ITC đã thực sự bắt đầu: không chỉ bằng những bài giảng, mà bằng chính những sản phẩm do sinh viên tạo nên.
$md$),
('vi', 'corelia-uef-khoi-dong-unihackfest-unitour-2026', 'corelia-uef-khoi-dong-unihackfest-unitour-2026', 'blog', 'published', $md$UEF Cùng Corelia Academy Khởi Động UniHackFest 2026: Hành Trình Chinh Phục AI Và Web3$md$, $md$Ngày 15/06/2026, UEF phối hợp cùng Corelia Academy khởi động UniHackFest 2026, mở ra hành trình 14 tuần học tập, trải nghiệm và phát triển dự án AI, Blockchain, Web3 cho sinh viên toàn quốc.$md$, 'corelia-team', 'announcements-events', ARRAY['web3','blockchain-fundamentals','dapp-development','ecosystem','project-based','hackathon']::text[], '{"type":"image","src":"/blog/corelia-uef-khoi-dong-unihackfest-unitour-2026/UEF01929.jpg","alt":"UEF và Corelia Academy khởi động UniHackFest 2026","fit":"cover"}'::jsonb, '2026-06-15'::date, '2026-06-15'::timestamptz, '2026-06-15'::timestamptz, $md$Sáng **15/06/2026**, Trường Đại học Kinh tế – Tài chính TP.HCM (UEF) phối hợp cùng **Corelia Academy** tổ chức Lễ khởi động cuộc thi **“Hackathon Web3 cho sinh viên – UniHackFest 2026”**. Sự kiện đánh dấu điểm bắt đầu của một sân chơi công nghệ quy mô toàn quốc dành cho sinh viên yêu thích đổi mới sáng tạo, đồng thời mở ra hành trình 14 tuần học tập, trải nghiệm và phát triển dự án trong các lĩnh vực AI, Blockchain, Web3 và tài sản số.

Chương trình quy tụ các chuyên gia, đại diện doanh nghiệp công nghệ, giảng viên và đông đảo sinh viên. Không chỉ giới thiệu một cuộc thi, lễ khởi động còn giúp người học tiếp cận những xu hướng công nghệ mới, kết nối với hệ sinh thái chuyên môn và hình dung rõ hơn con đường biến ý tưởng thành sản phẩm thực tiễn.

![UEF Cùng Corelia Academy Khởi Động UniHackFest 2026: Hành Trình Chinh Phục AI Và Web3](/blog/corelia-uef-khoi-dong-unihackfest-unitour-2026/_DSC0755.jpg)

## Khởi Đầu Sân Chơi Công Nghệ Dành Cho Sinh Viên Toàn Quốc

Tham dự chương trình, về phía UEF có **TS. Nhan Cẩm Trí – Phó Hiệu trưởng**; **TS. Văn Thị Thiên Trang – Phó Trưởng khoa Công nghệ thông tin**; **ThS. Hoàng Thị Hằng – Trợ lý Trưởng khoa Công nghệ thông tin**, cùng quý thầy cô và đông đảo sinh viên.

Về phía các đơn vị đồng hành và khách mời có **GS.TS. Nguyễn Tấn Anh – Giám đốc Trung tâm UNESCO Khoa học – Công nghệ và Tư vấn đầu tư phát triển**; **ông Thái Phạm Ngọc Tường – Founder Corelia Academy**; **bà Phan Nguyễn Mai Anh – Co-Founder Corelia Academy**; cùng đại diện MEXC Ventures, Solana Foundation, Open Campus, Chainlink Labs, OLYM3, CommandOSS, LazorKit và các trường đại học, cao đẳng đối tác.

Phát biểu khai mạc, TS. Nhan Cẩm Trí nhấn mạnh UniHackFest 2026 hướng đến việc tạo ra một sân chơi học thuật và công nghệ cho sinh viên trên toàn quốc. Thông qua môi trường thực tiễn, người học có cơ hội tiếp cận AI, Blockchain và Web3; phát triển năng lực chuyên môn, nghiên cứu và sáng tạo; đồng thời kết nối với doanh nghiệp và chuyên gia để mở rộng cơ hội nghề nghiệp trong tương lai.

![UEF Cùng Corelia Academy Khởi Động UniHackFest 2026: Hành Trình Chinh Phục AI Và Web3](/blog/corelia-uef-khoi-dong-unihackfest-unitour-2026/UEF01244.jpg)

GS.TS. Nguyễn Tấn Anh cũng chia sẻ về vai trò của thế hệ trẻ trong việc làm chủ và kiến tạo công nghệ trong kỷ nguyên số, tiếp thêm động lực để sinh viên chủ động khám phá những lĩnh vực mới.

![UEF Cùng Corelia Academy Khởi Động UniHackFest 2026: Hành Trình Chinh Phục AI Và Web3](/blog/corelia-uef-khoi-dong-unihackfest-unitour-2026/UEF01311.jpg)

## Lộ Trình 14 Tuần Học Tập, Trải Nghiệm Và Phát Triển Dự Án

Trong khuôn khổ lễ khởi động, **ông Thái Phạm Ngọc Tường – Founder Corelia Academy** giới thiệu tổng quan về UniHackFest 2026 và lộ trình 14 tuần được thiết kế theo hướng học tập gắn với thực hành, xây dựng sản phẩm.

![UEF Cùng Corelia Academy Khởi Động UniHackFest 2026: Hành Trình Chinh Phục AI Và Web3](/blog/corelia-uef-khoi-dong-unihackfest-unitour-2026/_DSC0898.jpg)

Sinh viên tham gia sẽ lần lượt trải nghiệm các hoạt động gồm **UniTour, Bootcamp Learning, Digital Assets Market, Solana Bootcamp, lớp kỹ năng thuyết trình, các workshop mentoring chuyên sâu, vòng sơ loại và Demo Day**. Song song với quá trình học và thi là những cơ hội kết nối trực tiếp với chuyên gia, doanh nghiệp và cộng đồng trong hệ sinh thái công nghệ.

Lộ trình này giúp các đội từng bước hoàn thiện ý tưởng, bổ sung kiến thức, phát triển dự án và làm quen với môi trường đổi mới sáng tạo chuyên nghiệp. Thay vì bước ngay vào một cuộc thi ngắn hạn, sinh viên có thời gian chuẩn bị cả tư duy sản phẩm, năng lực kỹ thuật lẫn kỹ năng trình bày.

## Góc Nhìn Toàn Cảnh Về Hệ Sinh Thái Solana

Tham gia trực tuyến từ Hàn Quốc, **bà Chaerin Kim – Chuyên viên Quan hệ Nhà phát triển tại Solana Foundation** chia sẻ chủ đề **“The Solana Builder Ecosystem”**. Nội dung mang đến bức tranh tổng quan về hệ sinh thái phát triển Solana và những cơ hội dành cho các nhà phát triển trẻ tại châu Á.

![UEF Cùng Corelia Academy Khởi Động UniHackFest 2026: Hành Trình Chinh Phục AI Và Web3](/blog/corelia-uef-khoi-dong-unihackfest-unitour-2026/UEF01620.jpg)

Từ góc nhìn của một hệ sinh thái công nghệ toàn cầu, phần chia sẻ giúp sinh viên hiểu rõ hơn cách cộng đồng builder vận hành, những nguồn lực dành cho nhà phát triển và tiềm năng tham gia của thế hệ trẻ Việt Nam.

Tiếp nối chương trình, **ông Phạm Minh Tuấn – External Developer Advocate, Solana Foundation** trình bày chủ đề **“Building on Solana: Why Now, Why Vietnam”**. Diễn giả phân tích lợi thế của Việt Nam trong cuộc đua công nghệ toàn cầu, xu hướng phát triển của hệ sinh thái Solana và nhu cầu đối với nguồn nhân lực chất lượng cao trong lĩnh vực Blockchain, Web3.

![UEF Cùng Corelia Academy Khởi Động UniHackFest 2026: Hành Trình Chinh Phục AI Và Web3](/blog/corelia-uef-khoi-dong-unihackfest-unitour-2026/UEF01644.jpg)

Những góc nhìn thực tiễn này giúp sinh viên nhận diện rõ hơn cơ hội nghề nghiệp, đồng thời chuẩn bị kiến thức và kỹ năng cần thiết để tham gia xây dựng các sản phẩm công nghệ mới.

## Tài Sản Số Và Làn Sóng Công Nghệ Mới

Ở góc độ thị trường, **bà Jenny Nguyễn – Head of Marketing and Strategic Partnerships, MEXC Ventures** mang đến chủ đề **“Digital Assets: The New Wave of Technology”**.

![UEF Cùng Corelia Academy Khởi Động UniHackFest 2026: Hành Trình Chinh Phục AI Và Web3](/blog/corelia-uef-khoi-dong-unihackfest-unitour-2026/UEF01580.jpg)

Phần trình bày phân tích xu hướng phát triển của tài sản số và những cơ hội mà công nghệ Blockchain đang mở ra cho thế hệ trẻ. Qua đó, sinh viên được tiếp cận tài sản số không chỉ như một chuyển động của thị trường mà còn như một lĩnh vực công nghệ đang tạo ra những mô hình sản phẩm, nghề nghiệp và nhu cầu nhân lực mới.

Nội dung cũng gợi mở cho các đội thi cách quan sát thị trường, nhận diện bài toán và tìm kiếm cơ hội ứng dụng công nghệ vào những nhu cầu thực tế.

## Edu Chain Và Chứng Chỉ Số Trong Giáo Dục

**Ông Cris Trần – Core-Contributor Open Campus, Co-Founder & CGO MoneyFi và S.H.E Blockchain** giới thiệu mô hình **Edu Chain** cùng hệ thống chứng chỉ số.

![UEF Cùng Corelia Academy Khởi Động UniHackFest 2026: Hành Trình Chinh Phục AI Và Web3](/blog/corelia-uef-khoi-dong-unihackfest-unitour-2026/UEF01691.jpg)

Phần chia sẻ giúp sinh viên hình dung cụ thể hơn tiềm năng ứng dụng của Blockchain trong giáo dục và phát triển nguồn nhân lực. Công nghệ có thể góp phần ghi nhận, xác minh quá trình học tập, kỹ năng và thành quả của người học theo những cách mới, từ đó hỗ trợ xây dựng hồ sơ năng lực minh bạch và kết nối tốt hơn với cơ hội nghề nghiệp.

Đây cũng là một ví dụ gần gũi về cách Blockchain có thể giải quyết những bài toán thực tiễn bên ngoài lĩnh vực tài chính, mở rộng không gian sáng tạo cho các đội tham gia UniHackFest 2026.

## Giao Lưu Về Công Nghệ, Nghề Nghiệp Và Phát Triển Dự Án

Trước khi chương trình khép lại, phiên giao lưu thu hút nhiều câu hỏi từ sinh viên xoay quanh xu hướng phát triển của AI và Web3, cơ hội nghề nghiệp trong ngành công nghệ cũng như kinh nghiệm xây dựng, phát triển dự án thực tiễn.

![UEF Cùng Corelia Academy Khởi Động UniHackFest 2026: Hành Trình Chinh Phục AI Và Web3](/blog/corelia-uef-khoi-dong-unihackfest-unitour-2026/_DSC1075.jpg)

![UEF Cùng Corelia Academy Khởi Động UniHackFest 2026: Hành Trình Chinh Phục AI Và Web3](/blog/corelia-uef-khoi-dong-unihackfest-unitour-2026/UEF01864.jpg)

Những trao đổi trực tiếp với các chuyên gia mang đến góc nhìn thực tế về thị trường và nhu cầu nhân lực. Đây cũng là nguồn động lực để sinh viên mạnh dạn theo đuổi ý tưởng sáng tạo, tìm kiếm đồng đội và thử sức tại cuộc thi.

## Từ Ý Tưởng Sáng Tạo Đến Sản Phẩm Có Giá Trị Thực Tiễn

![UEF Cùng Corelia Academy Khởi Động UniHackFest 2026: Hành Trình Chinh Phục AI Và Web3](/blog/corelia-uef-khoi-dong-unihackfest-unitour-2026/UEF01922.jpg)

Với sự đồng hành của các tổ chức công nghệ, doanh nghiệp và chuyên gia trong nước, quốc tế, UniHackFest 2026 không chỉ là một cuộc thi. Chương trình còn là môi trường để sinh viên khám phá tiềm năng bản thân, phát triển năng lực công nghệ và từng bước hiện thực hóa ý tưởng.

Hành trình 14 tuần khởi động từ UEF được kỳ vọng trở thành bệ phóng để các ý tưởng đột phá tiến gần hơn đến những sản phẩm có giá trị thực tiễn, đồng thời góp phần nuôi dưỡng thế hệ nhân lực công nghệ chất lượng cao trong thời đại số.

Corelia Academy sẽ tiếp tục đồng hành cùng UEF, các đối tác và cộng đồng trong hành trình này, kết nối hoạt động đào tạo với trải nghiệm thực hành và cơ hội phát triển dự án dành cho sinh viên toàn quốc.

**Tìm hiểu lộ trình và đăng ký tại [unihackfest.vn](https://unihackfest.vn/vi/?utm_source=corelia.academy&utm_medium=referral&utm_campaign=unihackfest_2026&utm_content=uef_kickoff_recap).**

*Nguồn tham khảo: [UEF khởi động UniHackFest 2026, mở ra hành trình chinh phục AI và Web3 cho sinh viên toàn quốc](https://www.uef.edu.vn/tin-tuc-su-kien/uef-khoi-dong-unihackfest-2026-mo-ra-hanh-trinh-chinh-phuc-ai-va-web3-cho-sinh-vien-toan-quoc-36846).*
$md$),
('vi', 'corelia-uii-innovation-talk-ueh-ai-web3-career-2026', 'corelia-uii-innovation-talk-ueh-ai-web3-career-2026', 'blog', 'published', $md$Corelia Academy Đồng Hành Cùng UII Innovation Talk Tại UEH$md$, $md$Ngày 06/08/2026, Corelia Academy cùng UniHackFest, Open Campus và MEXC Ventures đồng hành với UII Innovation Talk tại UEH về nghề nghiệp AI, Web3 và tài sản số.$md$, 'corelia-team', 'announcements-events', ARRAY['web3','ecosystem','mentorship','project-based','career-tips','hackathon']::text[], '{"type":"image","src":"/blog/corelia-uii-innovation-talk-ueh-ai-web3-career-2026/DJI_20260806111315_0237_D.jpg","alt":"Corelia Academy đồng hành cùng UII Innovation Talk về AI, Web3 và tài sản số tại UEH","fit":"cover"}'::jsonb, '2026-08-06'::date, '2026-08-06'::timestamptz, '2026-08-06'::timestamptz, $md$Sáng **06/08/2026**, **UII Innovation Talk: Navigating Your Career in AI, Web3 and Digital Assets** diễn ra tại **Đại học UEH**, kết nối sinh viên với những góc nhìn thực tiễn về thị trường, công nghệ và định hướng nghề nghiệp.

**Corelia Academy, UniHackFest, Open Campus** và **MEXC Ventures** đồng hành cùng chương trình trong khuôn khổ Học phần Kiến tập của Chương trình đào tạo Công nghệ và Đổi mới sáng tạo tại UEH. Thông qua chia sẻ chuyên môn, hoạt động nhóm, Fireside Chat và Q&A, sinh viên có cơ hội khám phá cách lựa chọn vai trò phù hợp và biến kiến thức thành năng lực có thể áp dụng.


## Nhìn thị trường tài sản số từ cơ hội nghề nghiệp

![Corelia Academy Đồng Hành Cùng UII Innovation Talk Tại UEH](/blog/corelia-uii-innovation-talk-ueh-ai-web3-career-2026/DJI_20260806093719_0105_D.jpg)

Trong phần chia sẻ mở đầu, **Jenny Nguyễn** mang đến góc nhìn về cơ hội dành cho sinh viên Việt Nam trong bối cảnh hành lang pháp lý về tài sản số năm 2026.

Sự phát triển của thị trường tạo ra nhu cầu ở nhiều nhóm năng lực. Bên cạnh kỹ thuật, hệ sinh thái cần người làm research, product, chiến lược, phân tích thị trường, truyền thông và phát triển cộng đồng. Sinh viên vì vậy có thể bắt đầu từ nền tảng hiện tại của mình, đồng thời bổ sung kiến thức về công nghệ, người dùng và bối cảnh thị trường.

Góc nhìn này cũng phản ánh cách Corelia Academy tiếp cận đào tạo builder. Một đội ngũ công nghệ mạnh cần khả năng kết hợp nhiều chuyên môn để hiểu đúng bài toán và xây dựng giải pháp có giá trị.

## Mini Ideathon: biến research thành hướng đi sản phẩm

![Corelia Academy Đồng Hành Cùng UII Innovation Talk Tại UEH](/blog/corelia-uii-innovation-talk-ueh-ai-web3-career-2026/DJI_20260806100029_0155_D.jpg)

Tại **Mini Ideathon: Research to Strategy** do **MEXC Ventures** tổ chức, sinh viên làm việc theo nhóm để nghiên cứu xu hướng, xác định cơ hội thị trường và đề xuất chiến lược sản phẩm trong AI, Web3 và tài sản số.

Hoạt động giúp sinh viên trải nghiệm một phần quan trọng của quá trình xây dựng sản phẩm. Research không chỉ là tìm kiếm và tổng hợp thông tin; nhóm cần phân tích điều gì thực sự đáng chú ý, cơ hội nào phù hợp với bối cảnh và hướng đi nào có thể chuyển thành hành động.

Khi được kết nối với tư duy sản phẩm, research trở thành nền tảng cho việc lựa chọn vấn đề, xác định người dùng và đưa ra quyết định. Đây là năng lực hữu ích cho cả thành viên kỹ thuật lẫn phi kỹ thuật trong một đội ngũ đổi mới sáng tạo.

## AI và năng lực thích nghi của người trẻ

![Corelia Academy Đồng Hành Cùng UII Innovation Talk Tại UEH](/blog/corelia-uii-innovation-talk-ueh-ai-web3-career-2026/DJI_20260806101931_0181_D.jpg)

**Cris D. Tran** tiếp nối chương trình với chủ đề AI vừa là đối thủ, vừa có thể trở thành trợ thủ đắc lực nhất của người trẻ.

AI đang thay đổi cách chúng ta học tập và làm việc. Một số tác vụ có thể được tự động hóa nhanh hơn, nhưng công nghệ cũng giúp sinh viên nghiên cứu, thử nghiệm và sáng tạo hiệu quả hơn. Khả năng thích nghi vì vậy không chỉ là học cách dùng công cụ, mà còn là xây dựng tư duy phản biện, kiến thức chuyên môn và năng lực đánh giá đầu ra.

Khi biết đặt AI vào một workflow rõ ràng, sinh viên có thể tăng tốc quá trình học và xây dựng sản phẩm mà vẫn giữ vai trò chủ động trong việc ra quyết định.

## Developer Lead, Product và Research trong cùng một đội

![Corelia Academy Đồng Hành Cùng UII Innovation Talk Tại UEH](/blog/corelia-uii-innovation-talk-ueh-ai-web3-career-2026/DJI_20260806110510_0216_D.jpg)

![Corelia Academy Đồng Hành Cùng UII Innovation Talk Tại UEH](/blog/corelia-uii-innovation-talk-ueh-ai-web3-career-2026/DJI_20260806105645_0209_D.jpg)

Trong Fireside Chat, **Thái Phạm Ngọc Tường** và **Cris D. Tran** trao đổi về vai trò của **Developer Lead, Product và Research** trong kỷ nguyên AI/Web3.

Developer Lead giúp đội ngũ đưa ra quyết định kỹ thuật và bảo đảm khả năng triển khai. Product kết nối nhu cầu người dùng với mục tiêu cùng ưu tiên phát triển. Research cung cấp dữ liệu, bối cảnh và những phân tích cần thiết để đội không xây dựng chỉ dựa trên giả định.

Ba vai trò đại diện cho những năng lực khác nhau nhưng bổ trợ chặt chẽ. Một sản phẩm cần được xây đúng, nhưng trước đó đội ngũ còn phải xác định mình đang giải quyết đúng vấn đề và hiểu vì sao hướng đi đã chọn có ý nghĩa.

Phiên Q&A mở ra cơ hội để sinh viên đặt câu hỏi về kỹ năng, định hướng nghề nghiệp và cách chuẩn bị cho thị trường AI/Web3. Đây là bước kết nối giữa những khái niệm trong chương trình với lựa chọn thực tế của từng người học.

## UniHackFest 2026: môi trường để biến định hướng thành trải nghiệm

![Corelia Academy Đồng Hành Cùng UII Innovation Talk Tại UEH](/blog/corelia-uii-innovation-talk-ueh-ai-web3-career-2026/DJI_20260806104036_0189_D.jpg)

Chương trình dành thời gian giới thiệu **UniHackFest 2026**, các chủ đề thi, vai trò trong một đội và cách sinh viên bắt đầu hành trình xây dựng với Web3 và AI.

Những định hướng nghề nghiệp chỉ thực sự rõ ràng khi được kiểm chứng qua trải nghiệm. Trong một dự án, sinh viên có thể hiểu sâu hơn điểm mạnh của mình, học cách phối hợp với những vai trò khác và tạo ra đầu ra cụ thể cho portfolio.

UII Innovation Talk thuộc Học phần Kiến tập diễn ra từ ngày 27/07 đến 15/09/2026 của Chương trình đào tạo Công nghệ và Đổi mới sáng tạo tại UEH. Các hoạt động trải nghiệm giúp sinh viên kết nối kiến thức lý thuyết với môi trường doanh nghiệp, rèn luyện khả năng quan sát, làm việc nhóm và trình bày ý tưởng, đồng thời chuẩn bị cho quá trình thực tập và phát triển nghề nghiệp.

Corelia Academy trân trọng cơ hội đồng hành cùng UEH, UniHackFest, Open Campus và MEXC Ventures trong chương trình học thuật ý nghĩa này. Chúng tôi sẽ tiếp tục góp phần kết nối sinh viên với kiến thức thực tiễn, mentorship và môi trường xây dựng sản phẩm.

![Corelia Academy Đồng Hành Cùng UII Innovation Talk Tại UEH](/blog/corelia-uii-innovation-talk-ueh-ai-web3-career-2026/DJI_20260806091004_0079_D.jpg)

**Tìm hiểu hành trình UniHackFest 2026 tại [unihackfest.vn](https://unihackfest.vn/vi/?utm_source=corelia_blog&utm_medium=content&utm_campaign=unihackfest_2026&utm_content=uii_innovation_talk_ueh_recap).**
$md$),
('vi', 'corelia-unihackfest-da-nang-campus-2026', 'corelia-unihackfest-da-nang-campus-2026', 'blog', 'published', $md$UniHackFest Đà Nẵng Campus 2026: Từ Cơ Hội Thị Trường Đến Ý Tưởng Sản Phẩm$md$, $md$Ngày 17/08/2026, UniHackFest Đà Nẵng Campus kết nối sinh viên với Digital Assets, Solana và tư duy sản phẩm qua Mini Ideation Sprint, Q&A và networking tại BTEC FPT Đà Nẵng.$md$, 'corelia-team', 'announcements-events', ARRAY['web3','blockchain-fundamentals','dapp-development','ecosystem','mentorship','hackathon']::text[], '{"type":"image","src":"/blog/corelia-unihackfest-da-nang-campus-2026/IMG_1999.jpg","alt":"Sinh viên và diễn giả tại UniHackFest Đà Nẵng Campus 2026","fit":"cover"}'::jsonb, '2026-08-17'::date, '2026-08-17'::timestamptz, '2026-08-17'::timestamptz, $md$Chiều **17/08/2026**, **UniHackFest Đà Nẵng Campus 2026** đã diễn ra tại **BTEC FPT Đà Nẵng**, mở ra không gian để sinh viên tiếp cận Digital Assets, Blockchain và Solana từ góc nhìn sản phẩm. Thay vì bắt đầu bằng những nội dung kỹ thuật phức tạp, chương trình dẫn dắt người tham dự từ cơ hội thị trường đến một ý tưởng có thể tiếp tục nghiên cứu và phát triển.

Sự kiện được tổ chức bởi **Corelia Academy, BTEC FPT và DUT Superteam University Club**, với sự tài trợ của **MEXC Ventures và Solana Foundation**, cùng sự tham gia của **FIC – Financial Investing Club, FPT Đà Nẵng**. Trong hơn ba giờ, sinh viên đã cùng diễn giả, mentor và cộng đồng builder đi qua các hoạt động chia sẻ, thực hành ý tưởng, hỏi đáp và kết nối.

## Mở rộng hợp tác để đưa cơ hội công nghệ đến gần sinh viên

Sau phần chào mừng từ đại diện BTEC FPT, chương trình đánh dấu một cột mốc hợp tác mới thông qua lễ ký kết biên bản ghi nhớ giữa **Corelia Academy và BTEC FPT**, đồng thời giữa **Corelia Academy và GALAXY Communications & Events**.

Những kết nối này hướng đến việc tạo thêm các hoạt động học tập thực tiễn, nơi sinh viên có thể tiếp cận kiến thức mới, gặp gỡ chuyên gia và từng bước biến điều đã học thành sản phẩm. Với Corelia Academy, hợp tác giữa nhà trường, cộng đồng và doanh nghiệp là nền tảng quan trọng để phát triển thế hệ builder trẻ có khả năng hiểu thị trường và chủ động xây dựng giải pháp.

## Nhìn Digital Assets từ cơ hội dành cho student builders

![UniHackFest Đà Nẵng Campus 2026: Từ Cơ Hội Thị Trường Đến Ý Tưởng Sản Phẩm](/blog/corelia-unihackfest-da-nang-campus-2026/IMG_1751.jpg)

Trong phiên **“Digital Assets & Opportunities for Student Builders”**, **Ms. Theon từ MEXC Ventures** giúp sinh viên nhìn thị trường tài sản số qua lăng kính của người xây dựng sản phẩm.

Thay vì chỉ theo dõi biến động hoặc xu hướng, một builder cần quan sát những vấn đề chưa được giải quyết, hiểu nhu cầu của người dùng và đánh giá công nghệ có thể tạo ra giá trị ở đâu. Cách tiếp cận này giúp những khái niệm như Digital Assets và Blockchain trở nên gần gũi hơn: đó không chỉ là chủ đề công nghệ, mà còn là một không gian sản phẩm với nhiều bài toán thực tế đang chờ được khám phá.

## Solana cho mọi người và cấu trúc của một ứng dụng thực tế

![UniHackFest Đà Nẵng Campus 2026: Từ Cơ Hội Thị Trường Đến Ý Tưởng Sản Phẩm](/blog/corelia-unihackfest-da-nang-campus-2026/IMG_1817.jpg)

Hai phiên **“Solana for Everyone”** và **“Anatomy of a Solana App”** tiếp tục nối tư duy sản phẩm với nền tảng công nghệ. **Danh Đoàn, đại diện DUT Superteam University Club**, cùng **Thái Phạm Ngọc Tường từ Corelia Academy** giới thiệu cách một ứng dụng Solana được hình thành và các thành phần phối hợp để tạo nên trải nghiệm hoàn chỉnh.

Qua những ví dụ gần gũi, sinh viên có thêm góc nhìn về mối liên hệ giữa ý tưởng, luồng người dùng và hạ tầng on-chain. Một sản phẩm không bắt đầu từ việc cố gắng đưa mọi tính năng lên blockchain; đội ngũ cần hiểu giá trị cốt lõi, lựa chọn phần cần được triển khai on-chain và thiết kế trải nghiệm để người dùng có thể tương tác một cách rõ ràng.

## Đối thoại trực tiếp với cộng đồng builder

![UniHackFest Đà Nẵng Campus 2026: Từ Cơ Hội Thị Trường Đến Ý Tưởng Sản Phẩm](/blog/corelia-unihackfest-da-nang-campus-2026/IMG_1970.jpg)

Phiên **Open Q&A: From Idea to Building on Solana** kết nối MEXC Ventures, DUT Superteam University Club và Corelia Academy với những câu hỏi trực tiếp từ sinh viên. Cuộc trao đổi mở rộng từ cơ hội thị trường, cách phát triển ý tưởng đến những bước đầu tiên khi xây dựng trên Solana.

Bên cạnh nội dung trên sân khấu, thời gian networking tạo điều kiện để sinh viên gặp gỡ diễn giả, mentor và những người có cùng mối quan tâm. Đây cũng là cơ hội để các bạn tìm kiếm cộng sự có kỹ năng bổ trợ, trao đổi về hướng phát triển ý tưởng và kết nối sâu hơn với cộng đồng công nghệ tại Đà Nẵng.

## Từ một buổi workshop đến hành trình xây dựng dài hơn

![UniHackFest Đà Nẵng Campus 2026: Từ Cơ Hội Thị Trường Đến Ý Tưởng Sản Phẩm](/blog/corelia-unihackfest-da-nang-campus-2026/IMG_1745.jpg)

UniHackFest Đà Nẵng Campus 2026 khép lại với nguồn năng lượng tích cực và nhiều ý tưởng được hình thành ngay trong buổi chiều. Quan trọng hơn, chương trình cho thấy sinh viên không cần chờ đến khi biết mọi thứ mới có thể bắt đầu. Một vấn đề đáng quan tâm, tinh thần học hỏi và đội ngũ sẵn sàng thử nghiệm đã là nền tảng cho bước đi đầu tiên.

Corelia Academy trân trọng sự phối hợp của BTEC FPT, DUT Superteam University Club, GALAXY Communications & Events và FIC – Financial Investing Club; đồng thời cảm ơn MEXC Ventures và Solana Foundation đã đồng hành để đưa cơ hội học tập và xây dựng sản phẩm đến gần hơn với sinh viên Đà Nẵng.

Hành trình UniHackFest sẽ tiếp tục kết nối những builder trẻ với kiến thức, mentorship và hệ sinh thái cần thiết để đưa ý tưởng tiến gần hơn đến một sản phẩm có thể hoạt động.
$md$),
('vi', 'corelia-unihackfest-hutech-from-ideas-to-working-product-2026', 'corelia-unihackfest-hutech-from-ideas-to-working-product-2026', 'blog', 'published', $md$Corelia Academy Cùng UniHackFest Và HUTECH Đưa Ý Tưởng Thành Sản Phẩm$md$, $md$Ngày 05/08/2026, Corelia Academy cùng UniHackFest và HUTECH tổ chức workshop From Ideas to Working Product, kết nối Digital Assets, Solana, AI với hoạt động Mini Ideation dành cho sinh viên.$md$, 'corelia-team', 'announcements-events', ARRAY['web3','dapp-development','ecosystem','mentorship','project-based','hackathon']::text[], '{"type":"image","src":"/blog/corelia-unihackfest-hutech-from-ideas-to-working-product-2026/73A09668-1.jpg","alt":"Corelia Academy cùng UniHackFest và HUTECH tổ chức workshop From Ideas to Working Product","fit":"cover"}'::jsonb, '2026-08-05'::date, '2026-08-05'::timestamptz, '2026-08-05'::timestamptz, $md$Sáng **05/08/2026**, **Corelia Academy** cùng Ban Tổ chức **UniHackFest 2026** và **HUTECH** mang workshop **“From Ideas to Working Product”** đến HUTECH Thu Duc Campus. Chương trình kết hợp chia sẻ chuyên môn và Mini Ideation, giúp sinh viên tiếp cận hành trình phát triển sản phẩm từ việc lựa chọn vấn đề, xác định người dùng đến xây dựng một working demo có thể trình diễn.

Với sự đồng hành của **MEXC Ventures** và **Solana**, workshop kết nối những góc nhìn về Digital Assets, Web3, AI và hạ tầng blockchain với tư duy sản phẩm thực tế. Sinh viên thuộc mọi ngành học đều có thể bắt đầu, kể cả khi chưa có kinh nghiệm Web3, chưa hình thành ý tưởng hoặc chưa tìm được đội ngũ.


## Corelia Academy đưa hành trình học để xây dựng đến HUTECH

![Corelia Academy Cùng UniHackFest Và HUTECH Đưa Ý Tưởng Thành Sản Phẩm](/blog/corelia-unihackfest-hutech-from-ideas-to-working-product-2026/73A09536-1.jpg)

Trong phần giới thiệu UniHackFest 2026, **Thái Phạm Ngọc Tường, Founder Corelia Academy**, chia sẻ tổng quan về lộ trình chương trình, hai track thi đấu, bốn nhóm chủ đề sản phẩm và những cơ hội dành cho sinh viên HUTECH.

Hai track **Best Product & Business** và **Best Technical Build** tạo không gian cho các đội phát huy những năng lực khác nhau. Một sản phẩm cần nền tảng kỹ thuật đủ tốt, nhưng cũng cần hiểu đúng vấn đề, xác định người dùng, thiết kế trải nghiệm và truyền đạt được giá trị.

Bốn nhóm chủ đề **RWA & Tokenization**, **Consumer dApps**, **DeFi & Digital Assets** và **AI × Web3** mở ra nhiều điểm bắt đầu cho sinh viên. Các bạn học công nghệ có thể tập trung vào cách triển khai; sinh viên tài chính, kinh doanh, thiết kế hoặc truyền thông có thể đóng góp góc nhìn thị trường, người dùng và sản phẩm.

Đây cũng là định hướng Corelia Academy theo đuổi trong quá trình đào tạo builder: kiến thức chỉ thực sự phát huy giá trị khi người học có thể dùng nó để xây dựng, thử nghiệm và cải thiện một giải pháp.

## Từ thị trường Digital Assets đến bài toán sản phẩm

![](/blog/corelia-unihackfest-hutech-from-ideas-to-working-product-2026/73A09536-1.jpg)
![Corelia Academy Cùng UniHackFest Và HUTECH Đưa Ý Tưởng Thành Sản Phẩm](/blog/corelia-unihackfest-hutech-from-ideas-to-working-product-2026/73A09567.jpg)

Phiên **Digital Asset Market & Opportunities for Student Builders** giúp sinh viên tiếp cận bối cảnh của thị trường tài sản số và những cơ hội dành cho người trẻ muốn bắt đầu xây dựng sản phẩm.

Thay vì dừng ở xu hướng thị trường, nội dung được nối trực tiếp với Mini Ideation. Sinh viên cùng brainstorm theo nhóm, lựa chọn một vấn đề, xác định người dùng mục tiêu và phác họa ý tưởng ban đầu. Một số nhóm có cơ hội trình bày trước diễn giả và Ban Tổ chức để nhận phản hồi trực tiếp.

Quá trình này giúp người học chuyển từ câu hỏi “công nghệ nào đang nổi bật” sang câu hỏi quan trọng hơn: “người dùng đang gặp vấn đề gì và sản phẩm có thể tạo ra giá trị ở đâu”. Đó là bước chuyển cần thiết để một ý tưởng công nghệ trở thành một hướng phát triển sản phẩm có cơ sở.

## Building on Solana: xây thứ có thể hoạt động

![Corelia Academy Cùng UniHackFest Và HUTECH Đưa Ý Tưởng Thành Sản Phẩm](/blog/corelia-unihackfest-hutech-from-ideas-to-working-product-2026/73A09658.jpg)

Phiên **“Building on Solana: From Idea to Working Product”** giới thiệu cơ hội phát triển sản phẩm trên Solana, cách chọn bài toán phù hợp và những yếu tố cần có trong một working demo thực tế.

Một sản phẩm ở giai đoạn đầu không cần hoàn thiện mọi tính năng. Điều quan trọng là đội ngũ xác định được giá trị cốt lõi, thiết kế luồng người dùng rõ ràng và xây dựng đủ chức năng để kiểm chứng giả thuyết. Khi demo có thể hoạt động và trình diễn được, nhóm phát triển sẽ có cơ sở cụ thể để thu nhận phản hồi và quyết định bước tiếp theo.

Góc nhìn này phù hợp với phương pháp học theo dự án tại Corelia Academy: học công nghệ trong bối cảnh một vấn đề thật, tạo ra đầu ra cụ thể và cải thiện sản phẩm qua từng vòng thử nghiệm.

## AI và lợi thế mới của người trẻ

![Corelia Academy Cùng UniHackFest Và HUTECH Đưa Ý Tưởng Thành Sản Phẩm](/blog/corelia-unihackfest-hutech-from-ideas-to-working-product-2026/73A09638.jpg)

Trong phiên **“AI: Đối thủ đáng gờm hay trợ thủ đắc lực của người trẻ?”**, **Cris D. Trần từ Open Campus** chia sẻ góc nhìn về ảnh hưởng của AI đối với học tập, nghề nghiệp và tương lai của thế hệ trẻ.

AI có thể giúp sinh viên nghiên cứu nhanh hơn, cải thiện năng suất, phát triển kỹ năng và tăng tốc quá trình sáng tạo. Tuy nhiên, lợi thế bền vững vẫn đến từ khả năng hiểu vấn đề, đặt câu hỏi có chất lượng, đánh giá kết quả và đưa ra quyết định phù hợp. Khi được sử dụng đúng cách, AI trở thành trợ thủ giúp một đội ngũ nhỏ thử nghiệm ý tưởng nhanh hơn và dành nhiều thời gian hơn cho người dùng cùng giá trị sản phẩm.

## Kết nối HUTECH với hệ sinh thái builder

![Corelia Academy Cùng UniHackFest Và HUTECH Đưa Ý Tưởng Thành Sản Phẩm](/blog/corelia-unihackfest-hutech-from-ideas-to-working-product-2026/73A09634-1.jpg)

Bên cạnh các phiên chia sẻ, thời gian networking tạo cơ hội để sinh viên gặp gỡ Ban Tổ chức, khách mời và những người có kỹ năng bổ trợ. Những cuộc trao đổi như vậy đặc biệt hữu ích với sinh viên chưa có đội, giúp các bạn tìm kiếm cộng sự và định hình vai trò của mình trong một nhóm liên ngành.

Workshop tại HUTECH cho thấy quá trình xây dựng sản phẩm có thể bắt đầu ngay từ campus. Từ một buổi brainstorm, sinh viên có thể tiếp tục hoàn thiện vấn đề, lựa chọn track thi đấu, phát triển working demo và tham gia sâu hơn vào hành trình UniHackFest 2026.

Corelia Academy trân trọng sự phối hợp của HUTECH, Ban Tổ chức UniHackFest 2026 và sự đồng hành của các đối tác trong việc đưa kiến thức thực tiễn cùng cơ hội xây dựng sản phẩm đến gần hơn với sinh viên. Chúng tôi sẽ tiếp tục kết nối đào tạo, mentorship và hệ sinh thái để giúp những builder trẻ biến ý tưởng thành sản phẩm có giá trị.

![Corelia Academy Cùng UniHackFest Và HUTECH Đưa Ý Tưởng Thành Sản Phẩm](/blog/corelia-unihackfest-hutech-from-ideas-to-working-product-2026/73A09515-1.jpg)

**Tìm hiểu hành trình UniHackFest 2026 tại [unihackfest.vn](https://unihackfest.vn/vi/?utm_source=corelia_blog&utm_medium=content&utm_campaign=unihackfest_2026&utm_content=hutech_workshop_recap).**
$md$),
('vi', 'corelia-unihackfest-unitour-van-hien-solana-2026', 'corelia-unihackfest-unitour-van-hien-solana-2026', 'blog', 'published', $md$Corelia Academy Cùng UniHackFest Kết Nối Sinh Viên Văn Hiến Với Hệ Sinh Thái Solana$md$, $md$Ngày 14/08/2026, Corelia Academy cùng UniHackFest đưa Chaerin Kim từ Solana Foundation trực tiếp đến Đại học Văn Hiến, kết nối Mini Ideation với lộ trình xây dựng sản phẩm Solana.$md$, 'corelia-team', 'announcements-events', ARRAY['web3','blockchain-fundamentals','dapp-development','ecosystem','mentorship','hackathon']::text[], '{"type":"image","src":"/blog/corelia-unihackfest-unitour-van-hien-solana-2026/_DSC3911.jpg","alt":"Corelia Academy kết nối Chaerin Kim và Solana Foundation với sinh viên Đại học Văn Hiến","fit":"cover"}'::jsonb, '2026-08-14'::date, '2026-08-14'::timestamptz, '2026-08-14'::timestamptz, $md$Sáng **14/08/2026**, **Corelia Academy** cùng Ban Tổ chức **UniHackFest 2026** phối hợp với **Trường Đại học Văn Hiến** tổ chức chương trình **UniHackFest UniTour** tại HungHau Campus. Workshop kết nối góc nhìn thị trường từ MEXC Ventures với định hướng kỹ thuật từ Solana Foundation, giúp sinh viên đi từ một ý tưởng ban đầu đến cách hình thành dự án và working demo.

Điểm nhấn đặc biệt là **Chaerin Kim, Developer Relations tại Solana Foundation**, trực tiếp có mặt tại Việt Nam và gặp gỡ sinh viên Văn Hiến. Khác với lần tham gia trực tuyến từ Hàn Quốc tại Kick-off UEF, chuyến hiện diện lần này đưa những chia sẻ về hệ sinh thái Solana đến gần hơn với cộng đồng builder trẻ ngay tại campus.

## Corelia Academy kết nối hành trình student builder tại Văn Hiến

![Corelia Academy Cùng UniHackFest Kết Nối Sinh Viên Văn Hiến Với Hệ Sinh Thái Solana](/blog/corelia-unihackfest-unitour-van-hien-solana-2026/_DSC3571-1.jpg)

Trong phần giới thiệu UniHackFest 2026, **Thái Phạm Ngọc Tường (Terran Thai), Founder Corelia Academy**, chia sẻ tổng quan chương trình, các chủ đề thi, learning track và hành trình từ ý tưởng đến working demo.

Một sản phẩm không bắt đầu từ việc lựa chọn công nghệ phức tạp nhất. Đội ngũ cần hiểu vấn đề, xác định người dùng, làm rõ giá trị và chọn một phạm vi đủ nhỏ để kiểm chứng. Working demo là cột mốc giúp nhóm biến giả thuyết thành trải nghiệm cụ thể, từ đó thu nhận phản hồi và tiếp tục cải thiện.

Đây là định hướng Corelia Academy theo đuổi trong phương pháp học theo dự án: kiến thức kỹ thuật cần được kết nối với tư duy sản phẩm, research và khả năng hợp tác. Mỗi sinh viên có thể bắt đầu từ thế mạnh của mình và phát triển thêm năng lực qua quá trình xây dựng thực tế.

## MEXC Ventures: từ Digital Asset Market đến Mini Ideation

![Corelia Academy Cùng UniHackFest Kết Nối Sinh Viên Văn Hiến Với Hệ Sinh Thái Solana](/blog/corelia-unihackfest-unitour-van-hien-solana-2026/_DSC3620.jpg)
![Corelia Academy Cùng UniHackFest Kết Nối Sinh Viên Văn Hiến Với Hệ Sinh Thái Solana](/blog/corelia-unihackfest-unitour-van-hien-solana-2026/_DSC3626.jpg)
![Corelia Academy Cùng UniHackFest Kết Nối Sinh Viên Văn Hiến Với Hệ Sinh Thái Solana](/blog/corelia-unihackfest-unitour-van-hien-solana-2026/_DSC3876.jpg)

**Theon, Brand Manager tại MEXC Ventures**, mang đến phiên **Digital Asset Market & Opportunities for Student Builders**, kết nối bối cảnh thị trường tài sản số với những bài toán sản phẩm sinh viên có thể khám phá.

Trong Mini Ideation Workshop, sinh viên brainstorm theo nhóm và hình thành các hướng ý tưởng ban đầu. Thay vì bắt đầu bằng một giải pháp, quá trình khuyến khích người học quan sát thị trường, nhận diện vấn đề và xác định nhóm người dùng có nhu cầu rõ ràng.

Góc nhìn đầu tư và thị trường giúp sinh viên hiểu rằng một ý tưởng kỹ thuật cần được đặt trong bối cảnh thực tế. Sản phẩm cần giải thích giá trị, đối tượng sử dụng và lý do công nghệ được chọn phù hợp hơn những cách tiếp cận hiện có.

## Chaerin Kim trực tiếp tại Việt Nam: mở cánh cửa vào hệ sinh thái Solana

![Corelia Academy Cùng UniHackFest Kết Nối Sinh Viên Văn Hiến Với Hệ Sinh Thái Solana](/blog/corelia-unihackfest-unitour-van-hien-solana-2026/_DSC3696.jpg)
![Corelia Academy Cùng UniHackFest Kết Nối Sinh Viên Văn Hiến Với Hệ Sinh Thái Solana](/blog/corelia-unihackfest-unitour-van-hien-solana-2026/_DSC3684.jpg)

Trong phiên **“Building on Solana: What Can You Build?”**, **Chaerin Kim** giới thiệu các thành phần cơ bản của một sản phẩm Solana: **wallet, token, payment, program hoặc smart contract, dữ liệu on-chain** và frontend.

Từ những thành phần đó, sinh viên có thể hình dung nhiều dạng sản phẩm như payment app, loyalty hoặc reward, marketplace, DeFi, consumer app hay ứng dụng kết hợp **AI × blockchain**.

Sự hiện diện trực tiếp của Chaerin Kim tại Việt Nam mang ý nghĩa vượt ra ngoài một bài trình bày kỹ thuật. Sinh viên có cơ hội tiếp cận gần hơn với đại diện Solana Foundation, nhìn thấy con đường kết nối từ campus Việt Nam đến một hệ sinh thái builder quốc tế.

Nội dung cũng giúp người học tránh cách tiếp cận “đưa blockchain vào mọi thứ”. Một sản phẩm nên sử dụng Solana khi bài toán thực sự cần giao dịch, quyền sở hữu, dữ liệu có thể xác minh hoặc logic on-chain. Khi lý do sử dụng công nghệ đủ rõ, đội ngũ mới có thể thiết kế một demo tập trung và thuyết phục.

Đối với Corelia Academy, những điểm kết nối trực tiếp như chuyến thăm của Chaerin Kim là một phần quan trọng trong việc đưa nguồn lực quốc tế đến gần sinh viên. Builder trẻ không chỉ học từ tài liệu mà còn được trao đổi với những người đang phát triển và hỗ trợ hệ sinh thái.


## Kết nối nhà trường, hệ sinh thái và thế hệ builder mới

![Corelia Academy Cùng UniHackFest Kết Nối Sinh Viên Văn Hiến Với Hệ Sinh Thái Solana](/blog/corelia-unihackfest-unitour-van-hien-solana-2026/_DSC3739-1.jpg)

Phiên Q&A cùng sponsor, mentor và Ban Tổ chức tạo điều kiện để sinh viên đặt câu hỏi về chương trình, Solana, chủ đề thi, cách lập đội và bước đầu phát triển sản phẩm.

UniTour tại Văn Hiến tiếp tục cho thấy giá trị của sự kết nối giữa nhà trường, đơn vị đào tạo, quỹ đầu tư và hệ sinh thái công nghệ. Sinh viên tiếp cận nhiều góc nhìn trong cùng một hành trình: từ thị trường, ý tưởng, sản phẩm đến kỹ thuật triển khai.

Corelia Academy trân trọng sự phối hợp của Trường Đại học Văn Hiến, Ban Tổ chức UniHackFest 2026, MEXC Ventures và Solana Foundation. Đặc biệt, sự hiện diện trực tiếp của Chaerin Kim tại Việt Nam đã tạo nên một điểm chạm ý nghĩa, giúp sinh viên Văn Hiến đến gần hơn với cộng đồng builder Solana toàn cầu.

![Corelia Academy Cùng UniHackFest Kết Nối Sinh Viên Văn Hiến Với Hệ Sinh Thái Solana](/blog/corelia-unihackfest-unitour-van-hien-solana-2026/_DSC3855-1.jpg)
![Corelia Academy Cùng UniHackFest Kết Nối Sinh Viên Văn Hiến Với Hệ Sinh Thái Solana](/blog/corelia-unihackfest-unitour-van-hien-solana-2026/_DSC3585.jpg)

**Tìm hiểu hành trình UniHackFest 2026 tại [unihackfest.vn](https://unihackfest.vn/vi/?utm_source=corelia_blog&utm_medium=content&utm_campaign=unihackfest_2026&utm_content=van_hien_solana_unitour_recap).**
$md$),
('vi', 'corelia-unihackfest-unitour-van-lang-2026', 'corelia-unihackfest-unitour-van-lang-2026', 'blog', 'published', $md$Corelia Academy Cùng UniHackFest UniTour Truyền Cảm Hứng Student Builder Tại Đại Học Văn Lang$md$, $md$Ngày 11/07/2026, UniHackFest UniTour đến Trường Đại học Văn Lang, kết nối sinh viên với AI, Web3, Blockchain, Digital Assets và hoạt động thực hành phát triển ý tưởng sản phẩm.$md$, 'corelia-team', 'announcements-events', ARRAY['web3','blockchain-fundamentals','ecosystem','mentorship','project-based','hackathon']::text[], '{"type":"image","src":"/blog/corelia-unihackfest-unitour-van-lang-2026/_DSC2776.jpg","alt":"Corelia Academy và UniHackFest UniTour tại Trường Đại học Văn Lang","fit":"cover"}'::jsonb, '2026-07-11'::date, '2026-07-11'::timestamptz, '2026-07-11'::timestamptz, $md$Chiều **11/07/2026**, **Khoa Công nghệ Thông tin - Trường Đại học Văn Lang** phối hợp cùng Ban Tổ chức **UniHackFest 2026** tổ chức chương trình **UniHackFest UniTour**. Điểm dừng mới của hành trình UniTour mang đến cho sinh viên không gian tiếp cận các xu hướng công nghệ, trao đổi trực tiếp với chuyên gia và thực hành phát triển ý tưởng sản phẩm.

Với sự đồng hành của các chuyên gia đến từ **Corelia Academy, MEXC Ventures** và **Solana Foundation**, chương trình kết nối kiến thức về **AI, Web3, Blockchain** và **Digital Assets** với tư duy giải quyết vấn đề thực tế. Đây cũng là cơ hội để sinh viên Văn Lang hiểu rõ hơn hành trình trở thành những **student builder**: không chỉ học công nghệ mà còn biết hình thành đội ngũ, kiểm chứng ý tưởng và từng bước đưa giải pháp thành sản phẩm.

![Corelia Academy Cùng UniHackFest UniTour Truyền Cảm Hứng Student Builder Tại Đại Học Văn Lang](/blog/corelia-unihackfest-unitour-van-lang-2026/_DSC2307.jpg)

## Đưa Hành Trình Student Builder Đến Gần Sinh Viên Văn Lang

![Corelia Academy Cùng UniHackFest UniTour Truyền Cảm Hứng Student Builder Tại Đại Học Văn Lang](/blog/corelia-unihackfest-unitour-van-lang-2026/_DSC2418.jpg)

Tại UniTour, sinh viên được giới thiệu tổng quan về **UniHackFest 2026**, các chủ đề thi, lộ trình học tập và những cơ hội phát triển trong suốt chương trình. Thay vì đặt cuộc thi như một đích đến tách biệt, hành trình được thiết kế để người tham gia học hỏi, thực hành và hoàn thiện năng lực xây dựng sản phẩm qua từng chặng.

Đối với sinh viên mới bắt đầu, bức tranh tổng quan giúp các bạn hình dung rõ hơn vai trò của mình trong một đội thi. Một sản phẩm công nghệ cần sự kết hợp giữa kỹ thuật, thiết kế trải nghiệm, hiểu biết thị trường, giao tiếp và khả năng trình bày giá trị. Mỗi sinh viên đều có thể bắt đầu từ thế mạnh hiện tại và phát triển thêm những kỹ năng cần thiết trong quá trình tham gia.

## Góc Nhìn Thực Tiễn Về AI, Web3 Và Tài Sản Số

![Corelia Academy Cùng UniHackFest UniTour Truyền Cảm Hứng Student Builder Tại Đại Học Văn Lang](/blog/corelia-unihackfest-unitour-van-lang-2026/_DSC2437.jpg)

Các chia sẻ từ đại diện **Corelia Academy, MEXC Ventures** và **Solana Foundation** đưa sinh viên đến gần hơn với những lĩnh vực đang góp phần định hình quá trình chuyển đổi số: AI, Web3, Blockchain và Digital Assets.

Những chủ đề này không được đặt riêng như các thuật ngữ công nghệ, mà được kết nối với câu hỏi quan trọng hơn: người trẻ có thể dùng công nghệ để giải quyết vấn đề nào và tạo ra giá trị ra sao? Góc nhìn từ đào tạo, thị trường và hệ sinh thái giúp sinh viên mở rộng cách tiếp cận, từ việc học một công cụ đến việc suy nghĩ về người dùng, bối cảnh ứng dụng và khả năng phát triển của sản phẩm.

Với Corelia Academy, đây là một phần quan trọng trong quá trình đào tạo builder. Nền tảng kỹ thuật cần đi cùng tư duy sản phẩm, khả năng hợp tác và tinh thần sẵn sàng thử nghiệm. Khi được tiếp cận những góc nhìn thực tiễn ngay tại campus, sinh viên có thêm cơ sở để lựa chọn hướng đi phù hợp và biến kiến thức thành đầu ra cụ thể.
## Mini Ideation Workshop: Từ Bài Toán Đến Ý Tưởng Sản Phẩm

![Corelia Academy Cùng UniHackFest UniTour Truyền Cảm Hứng Student Builder Tại Đại Học Văn Lang](/blog/corelia-unihackfest-unitour-van-lang-2026/_DSC2500.jpg)


Điểm nhấn của chương trình là **Mini Ideation Workshop**, nơi sinh viên cùng nhau thảo luận và xây dựng ý tưởng giải quyết các bài toán thực tế. Hoạt động đưa người tham gia ra khỏi vai trò người nghe để trực tiếp quan sát vấn đề, đề xuất giải pháp, phân chia vai trò và chuẩn bị phần trình bày.

Quá trình phát triển ý tưởng giúp các nhóm thực hành những câu hỏi nền tảng của một sản phẩm: vấn đề nào cần được giải quyết, ai là người gặp vấn đề, giải pháp mang lại giá trị gì và đâu là bước đầu tiên để kiểm chứng ý tưởng. Sau phần thảo luận, các nhóm trình bày kết quả và nhận góp ý từ chuyên gia, mentor cùng Ban Tổ chức.

Những phản hồi trực tiếp giúp sinh viên nhìn thấy điểm mạnh, khoảng trống và hướng cải thiện trong ý tưởng. Quan trọng hơn, workshop cho thấy việc xây dựng sản phẩm không bắt đầu từ một giải pháp thật lớn; nó bắt đầu từ khả năng hiểu đúng bài toán và sẵn sàng điều chỉnh dựa trên phản hồi.

![Corelia Academy Cùng UniHackFest UniTour Truyền Cảm Hứng Student Builder Tại Đại Học Văn Lang](/blog/corelia-unihackfest-unitour-van-lang-2026/_DSC2471.jpg)

![Corelia Academy Cùng UniHackFest UniTour Truyền Cảm Hứng Student Builder Tại Đại Học Văn Lang](/blog/corelia-unihackfest-unitour-van-lang-2026/_DSC2480.jpg)

## Kết Nối Nhà Trường, Chuyên Gia Và Hệ Sinh Thái Công Nghệ

![Corelia Academy Cùng UniHackFest UniTour Truyền Cảm Hứng Student Builder Tại Đại Học Văn Lang](/blog/corelia-unihackfest-unitour-van-lang-2026/_DSC2638.jpg)

Bên cạnh các phiên chia sẻ và workshop, sinh viên có cơ hội giao lưu, đặt câu hỏi trực tiếp với diễn giả và khách mời. Những cuộc trao đổi giúp các bạn làm rõ thắc mắc về công nghệ, quá trình phát triển sản phẩm cũng như cách chuẩn bị để tham gia UniHackFest 2026.

Chương trình đồng thời tạo ra điểm kết nối giữa nhà trường, đơn vị đào tạo, doanh nghiệp và hệ sinh thái công nghệ. Sinh viên được tiếp xúc với nhiều góc nhìn; các chuyên gia có cơ hội lắng nghe mối quan tâm của thế hệ builder trẻ; còn nhà trường mở rộng môi trường học tập thông qua những trải nghiệm gắn với thực tiễn.

Thông qua sự kết nối đó, sinh viên không chỉ cập nhật kiến thức mà còn rèn luyện kỹ năng làm việc nhóm, tư duy đổi mới sáng tạo, khả năng trình bày và thái độ chủ động khi phát triển sản phẩm.

## Từ Một Buổi UniTour Đến Hành Trình Xây Dựng Dài Hạn

![Corelia Academy Cùng UniHackFest UniTour Truyền Cảm Hứng Student Builder Tại Đại Học Văn Lang](/blog/corelia-unihackfest-unitour-van-lang-2026/_DSC2512.jpg)

Điểm dừng tại Trường Đại học Văn Lang khép lại với kỳ vọng sẽ có thêm nhiều đội thi tự tin bước vào UniHackFest 2026. Từ những ý tưởng đầu tiên trong workshop, sinh viên có thể tiếp tục tìm đồng đội, xác định bài toán muốn theo đuổi và chuẩn bị cho các vòng tiếp theo của chương trình.

Corelia Academy trân trọng sự phối hợp của Khoa Công nghệ Thông tin - Trường Đại học Văn Lang, Ban Tổ chức, các đối tác, chuyên gia và toàn thể sinh viên đã tạo nên một buổi chiều giàu năng lượng. Chúng tôi sẽ tiếp tục đồng hành để đưa kiến thức thực tiễn, tư duy sản phẩm và cơ hội xây dựng công nghệ đến gần hơn với cộng đồng sinh viên.

**Tìm hiểu hành trình và đăng ký tại [unihackfest.vn](https://unihackfest.vn/vi/?utm_source=corelia_blog&utm_medium=content&utm_campaign=unihackfest_2026&utm_content=van_lang_unitour_recap).**
$md$),
('vi', 'corelia-vibe-coding-day-hcmact-ai-product-2026', 'corelia-vibe-coding-day-hcmact-ai-product-2026', 'blog', 'published', $md$Corelia Academy Cùng HCMACT Và GDG Cloud HCMC Tổ Chức Vibe Coding Day$md$, $md$Ngày 12/08/2026, Corelia Academy và UniHackFest phối hợp cùng HCMACT, GDG Cloud HCMC tổ chức Vibe Coding Day, giúp sinh viên xây dựng ứng dụng AI qua thực hành.$md$, 'corelia-team', 'announcements-events', ARRAY['tooling','project-based','mentorship','ecosystem','hackathon','career-tips']::text[], '{"type":"image","src":"/blog/corelia-vibe-coding-day-hcmact-ai-product-2026/DSC01418-1.jpg","alt":"Corelia Academy cùng HCMACT và GDG Cloud HCMC tổ chức Vibe Coding Day in Campus","fit":"cover"}'::jsonb, '2026-08-12'::date, '2026-08-12'::timestamptz, '2026-08-12'::timestamptz, $md$Chiều **12/08/2026**, **Corelia Academy** và **UniHackFest** phối hợp cùng **Phân hiệu Học viện Kỹ thuật Mật mã tại TP.HCM (HCMACT)** và **Google Developer Groups Cloud Ho Chi Minh City (GDG Cloud HCMC)** tổ chức **Vibe Coding Day in Campus**. **Sumit Chandel, Developer Relations Engineer tại Google**, trực tiếp hướng dẫn sinh viên xây dựng ứng dụng AI trong phiên Build with Google AI, từ chuẩn bị môi trường đến tạo code, chạy demo và điều chỉnh sản phẩm.

Với thế mạnh về An toàn thông tin và Công nghệ phần mềm, sinh viên HCMACT có nền tảng phù hợp để khám phá cách AI tăng tốc quá trình phát triển mà vẫn duy trì tư duy kỹ thuật, kiểm thử và bảo mật. Đây cũng là tinh thần học qua dự án mà Corelia Academy theo đuổi: kiến thức cần được chuyển thành một đầu ra có thể chạy, kiểm chứng và tiếp tục cải thiện.

## Vibe coding: tăng tốc xây dựng, không thay thế tư duy kỹ thuật

![Corelia Academy Cùng HCMACT Và GDG Cloud HCMC Tổ Chức Vibe Coding Day](/blog/corelia-vibe-coding-day-hcmact-ai-product-2026/DSC01229.jpg)

Vibe coding cho phép người xây dựng mô tả tính năng bằng ngôn ngữ tự nhiên và sử dụng AI để hỗ trợ tạo hoặc chỉnh sửa code. Khi rào cản bắt đầu được hạ thấp, sinh viên có thể dành nhiều thời gian hơn cho vấn đề, người dùng và luồng sản phẩm.

Tốc độ không đồng nghĩa với việc bỏ qua nền tảng. Một đoạn code do AI tạo ra vẫn có thể chứa lỗi, xử lý thiếu trường hợp hoặc tạo ra rủi ro bảo mật. Người phát triển cần đọc và hiểu cấu trúc, chạy thử, kiểm tra dữ liệu, xác thực đầu vào và đánh giá xem kết quả có đúng với mục tiêu ban đầu hay không.

Đối với Corelia Academy, AI là một công cụ trong workflow của builder. Công cụ giúp thử nghiệm nhanh hơn, nhưng người xây dựng vẫn chịu trách nhiệm với quyết định kỹ thuật và chất lượng của sản phẩm.

## UniHackFest UniTour đến với sinh viên HCMACT

![Corelia Academy Cùng HCMACT Và GDG Cloud HCMC Tổ Chức Vibe Coding Day](/blog/corelia-vibe-coding-day-hcmact-ai-product-2026/DSC01150.jpg)

Chương trình giới thiệu **UniHackFest 2026**, hai bảng thi **Best Product & Business**, **Best Technical Build** và bốn nhóm chủ đề **RWA & Tokenization**, **Consumer dApps**, **DeFi & Digital Assets**, **AI × Web3**.

Phần UniTour giúp sinh viên nhìn thấy con đường tiếp nối sau workshop. Một ứng dụng nhỏ được xây trong buổi chiều có thể trở thành nguyên mẫu để đội ngũ tiếp tục nghiên cứu người dùng, làm rõ giá trị, phát triển kỹ thuật và chuẩn bị bài dự thi.

Sinh viên HCMACT không chỉ có lợi thế ở khả năng viết phần mềm. Góc nhìn về an toàn thông tin có thể giúp các đội đặt câu hỏi tốt hơn về dữ liệu, quyền truy cập, rủi ro hệ thống và cách xây dựng sản phẩm đáng tin cậy ngay từ giai đoạn đầu.

## Build with Google AI: học bằng cách trực tiếp xây dựng

![Corelia Academy Cùng HCMACT Và GDG Cloud HCMC Tổ Chức Vibe Coding Day](/blog/corelia-vibe-coding-day-hcmact-ai-product-2026/DSC01441-1.jpg)

**GDG Cloud HCMC** giới thiệu cách tiếp cận **Build with Google AI** và trực tiếp vận hành phiên thực hành. Đồng hành trong vai trò người hướng dẫn chính là **Sumit Chandel, Developer Relations Engineer tại Google**.

Sumit Chandel dẫn dắt sinh viên từng bước xây dựng ứng dụng AI đầu tiên trên laptop, từ chuẩn bị môi trường và mô tả tính năng đến tạo code, chạy thử và điều chỉnh kết quả. Sự hướng dẫn trực tiếp từ một chuyên gia developer relations giúp người tham dự tiếp cận công cụ mới trong một quy trình có cấu trúc, đồng thời hiểu rõ hơn cách đặt yêu cầu để AI hỗ trợ hiệu quả.

Quá trình thực hành kết nối các bước thường bị tách rời khi học lý thuyết: xác định yêu cầu, mô tả tính năng, tạo code, chạy ứng dụng và xử lý kết quả chưa đúng. Sumit Chandel cùng đội ngũ mentor hỗ trợ người tham gia tháo gỡ vướng mắc, nhưng mỗi sinh viên vẫn là người trực tiếp thao tác và quan sát sản phẩm hình thành.

Khi một ứng dụng chạy được, người học có một nền tảng cụ thể để đặt câu hỏi sâu hơn: luồng nào cần cải thiện, tính năng nào thực sự cần thiết, dữ liệu được xử lý ra sao và điều gì phải kiểm thử trước khi đưa sản phẩm đến người dùng.

## Build Sprint: từ ứng dụng mẫu đến ý tưởng riêng

![Corelia Academy Cùng HCMACT Và GDG Cloud HCMC Tổ Chức Vibe Coding Day](/blog/corelia-vibe-coding-day-hcmact-ai-product-2026/DSC01543.jpg)

Trong **Build Sprint**, sinh viên có thể mở rộng ứng dụng mẫu hoặc bắt đầu phát triển ý tưởng riêng với mentor hỗ trợ tại chỗ.

Phiên làm việc khuyến khích người tham gia lựa chọn một phạm vi đủ nhỏ để hoàn thành và kiểm chứng. Thay vì cố gắng xây mọi tính năng, đội ngũ cần xác định luồng quan trọng nhất, làm rõ giá trị cốt lõi và tạo ra một demo có thể trình bày.

Đây là một phiên bản cô đọng của phương pháp phát triển sản phẩm theo vòng lặp: xây dựng, chạy thử, nhận phản hồi và điều chỉnh. Khi AI giúp rút ngắn thời gian triển khai, đội ngũ có thể thực hiện nhiều vòng thử nghiệm hơn, miễn là vẫn kiểm soát chất lượng và hiểu những gì mình đưa vào sản phẩm.

## Showcase và kết nối đội ngũ builder

![Corelia Academy Cùng HCMACT Và GDG Cloud HCMC Tổ Chức Vibe Coding Day](/blog/corelia-vibe-coding-day-hcmact-ai-product-2026/DSC01768.jpg)
![Corelia Academy Cùng HCMACT Và GDG Cloud HCMC Tổ Chức Vibe Coding Day](/blog/corelia-vibe-coding-day-hcmact-ai-product-2026/DSC01820.jpg)
![Corelia Academy Cùng HCMACT Và GDG Cloud HCMC Tổ Chức Vibe Coding Day](/blog/corelia-vibe-coding-day-hcmact-ai-product-2026/DSC01723.jpg)

Phần showcase dành không gian để một số sinh viên hoặc nhóm giới thiệu demo vừa xây dựng. Việc trình bày một sản phẩm đang ở giai đoạn đầu giúp người học luyện cách mô tả vấn đề, giải thích quyết định và tiếp nhận phản hồi.

Chương trình cũng tạo cơ hội kết nối đội nhóm cho UniHackFest. Những sinh viên mạnh về kỹ thuật, bảo mật, sản phẩm, thiết kế hoặc nghiên cứu có thể tìm thấy những người bổ trợ cho mình và tiếp tục phát triển ý tưởng sau sự kiện.

Từ Vibe Coding Day, sinh viên có thể tham gia UniHackFest theo hình thức linh hoạt, học qua các tài nguyên online, lập nhóm, lựa chọn chủ đề, phát triển demo và hướng đến Demo Day. Các dự án nổi bật còn có cơ hội tiếp cận mentoring, truyền thông, đối tác và hoạt động ươm tạo.

Corelia Academy trân trọng sự đăng cai của HCMACT và sự phối hợp của GDG Cloud HCMC trong việc tạo ra một trải nghiệm thực hành dành cho sinh viên. Chúng tôi sẽ tiếp tục đồng hành để kết nối kiến thức, công cụ và hệ sinh thái, giúp builder trẻ đi từ ý tưởng đến sản phẩm có thể hoạt động.

![Corelia Academy Cùng HCMACT Và GDG Cloud HCMC Tổ Chức Vibe Coding Day](/blog/corelia-vibe-coding-day-hcmact-ai-product-2026/DSC01371.jpg)

**Tìm hiểu hành trình UniHackFest 2026 tại [unihackfest.vn](https://unihackfest.vn/vi/?utm_source=corelia_blog&utm_medium=content&utm_campaign=unihackfest_2026&utm_content=vibe_coding_day_hcmact_recap).**

*GDG Cloud HCMC là một cộng đồng độc lập. Các hoạt động và quan điểm trình bày tại sự kiện không đại diện cho Google.*
$md$),
('vi', 'insted-2026-corelia-academy', 'insted-2026-corelia-academy', 'blog', 'published', $md$Dấu ấn Corelia Academy tại Sự kiện INSTED 2026: Bước Tiến Chiến Lược Cho Giáo Dục Web3 Tại Việt Nam$md$, $md$Sáng 05/03/2026 tại SIHUB (TP.HCM), Corelia Academy góp mặt tại Họp mặt Đầu năm – Giáo dục AI & Blockchain do INSTED tổ chức, trình bày tầm nhìn Web3 Product Builder và ký kết MOU chiến lược.$md$, 'terran', 'career-ecosystem-insights', ARRAY['web3','blockchain-fundamentals','ecosystem','project-based','mentorship','career-tips']::text[], '{"type":"image","src":"/blog/DSC08750.JPG","alt":"Corelia Academy tại Sự kiện INSTED 2026 - Giáo dục AI & Blockchain, SIHUB TP.HCM","ogSrc":"/blog/og/DSC08750.JPG"}'::jsonb, '2026-03-05'::date, '2026-03-05'::timestamptz, '2026-03-05'::timestamptz, $md$Sáng ngày 05/03/2026, tại không gian đổi mới sáng tạo SIHUB (TP.HCM), Corelia Academy đã vinh dự góp mặt và tạo dấu ấn mạnh mẽ tại sự kiện "Họp mặt Đầu năm 2026 – Giáo dục AI & Blockchain" do Viện Phát triển Khoa học Công nghệ và Giáo dục (INSTED) tổ chức. Đây không chỉ là một sự kiện kết nối thông thường, mà còn là cột mốc khẳng định cam kết của Corelia trong việc đưa giáo dục Web3 thực chiến đến gần hơn với hệ thống giáo dục chính quy.

Bạn có thể tìm hiểu thêm về đơn vị này tại [website chính thức của INSTED](https://insted.edu.vn/).

Kỷ nguyên số đang chứng kiến sự trỗi dậy mạnh mẽ của AI và Blockchain. Tuy nhiên, thị trường Việt Nam vẫn đang đối mặt với bài toán lớn: thiếu hụt trầm trọng nguồn nhân lực có tư duy kiến trúc hệ thống và khả năng xây dựng sản phẩm thực tế (Product Builder). Nhận thức rõ điều này, Corelia Academy đã mang đến sự kiện INSTED 2026 những giải pháp chiến lược thông qua hai hoạt động trọng tâm.

## 1. Lan tỏa tầm nhìn "Kiến tạo thế hệ Web3 Product Builder" trên sân khấu lớn

![](/blog/z7594455824388_000612a7f194f5f8fdd36e35ceb6e3f9.jpg)

Tại phiên đối thoại chiến lược của sự kiện, đại diện Corelia Academy đã có phần trình bày chia sẻ bức tranh toàn cảnh về thực trạng nhân sự IT hiện nay và giải pháp đào tạo đột phá của học viện.

Thay vì chỉ tập trung vào việc đào tạo ra những "thợ gõ code", Corelia nhấn mạnh triết lý cốt lõi: **"Tài Sản Số Đi Trước – Công Nghệ Theo Sau"**. Chúng tôi mang đến sự kiện thông điệp mạnh mẽ về Hệ sinh thái 3 Trụ cột đang được vận hành tại học viện:

- **Đối với Học viên (Learners):** Xây dựng tư duy toàn cảnh về DeFi, Tokenomics và mô hình kinh doanh Web3 trước khi đi sâu vào lập trình thông qua "Học kỳ Web3" kéo dài 3–6 tháng.

- **Đối với Đại học (Universities):** Đóng vai trò cầu nối công nghiệp với tiêu chí "Zero-Burden", hỗ trợ các trường tích hợp tín chỉ học thuật và đồng tổ chức các giải đấu Hackathon/Bootcamp ngay tại campus.

- **Đối với Doanh nghiệp (B2B Solutions):** Giải quyết cơn khát nhân sự chất lượng cao thông qua mạng lưới Talent Placement và mô hình "Squad-as-a-Service".

Sự hưởng ứng từ các chuyên gia, đại diện trường đại học (như Bách Khoa, Tôn Đức Thắng, Gia Định, Văn Lang) và các doanh nghiệp có mặt tại sự kiện đã khẳng định mô hình đào tạo hướng tới dự án (Project-based learning) của Corelia đang đi đúng với nhu cầu khắt khe của thị trường.

## 2. Ký kết MOU chiến lược cùng Viện INSTED: Mở rộng hệ sinh thái giáo dục công nghệ

![](/blog/20260305_102931.jpg)

Điểm nhấn quan trọng nhất của Corelia tại sự kiện chính là nghi thức **Ký kết hợp tác chiến lược (MOU)** chính thức với Viện INSTED.

INSTED hiện đang là đơn vị tiên phong trong việc xây dựng khung năng lực AI & Blockchain chuẩn UNESCO cho học sinh, sinh viên và ứng dụng công nghệ chuỗi khối vào xác thực bản quyền số. Việc Corelia Academy trở thành đối tác chiến lược của INSTED mang lại những giá trị cộng hưởng to lớn:

- **Hợp lực chuyên môn:** Nền tảng kỹ thuật và giáo trình thực chiến từ các hệ sinh thái lớn (như Sui, Move) của Corelia sẽ là mảnh ghép hoàn hảo để INSTED hiện thực hóa mục tiêu phát triển nguồn nhân lực chất lượng cao.

- **Mở rộng cơ hội tiếp cận:** Thỏa thuận hợp tác này mở ra cánh cửa để các chương trình đào tạo của Corelia tiếp cận sâu rộng hơn với mạng lưới các trường đại học, cao đẳng và các cơ quan quản lý nhà nước.

## Hướng tới chặng đường bứt phá trong năm 2026

"AI tạo ra năng lực mới, Blockchain tạo ra niềm tin số". Sự kết hợp giữa giáo dục truyền thống và công nghệ phi tập trung đang định hình lại tương lai của nền kinh tế sáng tạo.

Sự kiện đầu năm cùng INSTED khép lại với những cái bắt tay đầy triển vọng, mở ra một năm 2026 bận rộn nhưng đầy hứng khởi cho đội ngũ Corelia Academy. Chúng tôi cam kết sẽ tiếp tục hoàn thiện hệ sinh thái của mình, đồng hành cùng các lập trình viên trẻ trên hành trình chuyển hóa thành những chuyên gia Web3 được săn đón toàn cầu.
$md$),
('vi', 'insted-2026-product-builder-talk', 'insted-2026-product-builder-talk', 'blog', 'published', $md$Đừng Chỉ Là "Thợ Gõ Code" – Định Hình Tư Duy Nền Tảng Cho Lập Trình Viên Web3 (INSTED 2026)$md$, $md$Bài thuyết trình của Founder Corelia Academy tại INSTED 2026: thực trạng nhân sự IT Việt Nam, triết lý "Tài sản số đi trước – Công nghệ theo sau" và hành trình trở thành Web3 Product Builder.$md$, 'terran', 'career-ecosystem-insights', ARRAY['web3','blockchain-fundamentals','ecosystem','project-based','mentorship','career-tips']::text[], '{"type":"youtube","url":"https://www.youtube.com/watch?v=zmpaw0_LCYY"}'::jsonb, '2026-03-05'::date, '2026-03-05'::timestamptz, '2026-03-05'::timestamptz, $md$Sáng ngày 05/03/2026, tại sự kiện Họp mặt Đầu năm do Viện Phát triển Khoa học Công nghệ và Giáo dục (INSTED) tổ chức, Terran – Founder của Corelia Academy đã có bài thuyết trình mang tính chiến lược về thực trạng nhân sự IT Việt Nam và định hướng kiến tạo thế hệ Web3 Product Builder.

**Video trên cùng là toàn văn bài thuyết trình (~10 phút).** Nếu bạn đang là lập trình viên hoặc sinh viên IT muốn chuyển mình sang kỷ nguyên Web3, đây là 10 phút bạn không nên bỏ lỡ.

## Nghịch lý của thị trường IT Việt Nam: Đông nhưng đang "khát"

Mở đầu bài thuyết trình, Founder Terran đã chỉ ra một bức tranh thị trường với những con số biết nói [00:46]:

- Dòng vốn tài sản số đổ vào Việt Nam đạt ngưỡng **120 tỷ USD/năm** (dữ liệu 2025).
- Gần **20 triệu người** (chiếm 20% dân số) đang sở hữu tài sản số.
- Việt Nam sở hữu lực lượng kỹ sư IT khổng lồ với hơn **560.000 người**.

Tuy nhiên, nguồn cung nhân lực cho ngành Web3 lại đang cực kỳ hạn chế. Phần lớn các lập trình viên hiện nay thiếu am hiểu về thị trường tài sản số, tài chính phi tập trung (DeFi) và cấu trúc của một sản phẩm Web3. Điều này dẫn đến một hiện tượng mà Corelia gọi là **"Hội chứng thợ gõ code"** [02:13] – những người chỉ biết nhận yêu cầu và gõ lệnh mà không hiểu bản chất sản phẩm mình đang xây dựng giải quyết vấn đề gì. Trong kỷ nguyên mà AI có thể viết code chỉ trong 15 phút, những "thợ gõ code" thụ động sẽ rất dễ bị đào thải.

## Triết lý đào tạo đột phá: "Tài sản số đi trước, công nghệ theo sau"

Để giải quyết bài toán trên, Corelia Academy mang đến một triết lý đào tạo hoàn toàn khác biệt [02:38]: **Tài sản số phải đi trước, công nghệ theo sau.**

Chúng tôi tin rằng việc hiểu *tại sao* phải dùng Blockchain và nền kinh tế phi tập trung vận hành ra sao quan trọng hơn việc học cách viết Blockchain. Lộ trình đào tạo của Corelia được thiết kế để xây dựng một **Tư duy toàn cảnh (Helicopter View)** [04:05] trước khi bước vào lập trình chuyên sâu, giúp học viên hiểu rõ cội nguồn của công nghệ, lịch sử thị trường và cách xây dựng mô hình kinh doanh tạo ra lợi nhuận.

## Hệ sinh thái 3 trụ cột của Corelia Academy

Không chỉ dừng lại ở các khóa học đơn lẻ, Corelia đang vận hành một hệ sinh thái giáo dục khép kín, kết nối chặt chẽ giữa 3 mắt xích:

1. **Khối Học viên (Learners):** Học tập qua thực chiến (Project-based). Học viên làm việc nhóm theo mô hình Product Team (gồm cả Dev, Product Manager, PD...) để build sản phẩm thật, giải quyết bài toán thật.

2. **Khối Đại học (Universities):** Corelia đóng vai trò là "Industry Bridge" (Cầu nối công nghiệp). Hiện tại, học viện đã hợp tác với hơn 10 trường Đại học lớn (như Văn Lang, Văn Hiến, Công Thương, Gia Định...) [04:45] để tổ chức Web3 Learning Tour và các Bootcamp 2 tuần. Chúng tôi hỗ trợ các trường theo tiêu chí **"Zero-Burden"** (Không áp lực chuyên môn), mang thẳng môi trường làm việc thực tế từ các dự án toàn cầu vào Campus.

3. **Khối Doanh nghiệp (B2B Solutions):** Cung cấp giải pháp nhân sự (Talent Placement) từ nguồn học viên đã được kiểm chứng. Đặc biệt, Corelia giới thiệu mô hình **Squad-as-a-Service** [08:02] – cung cấp trọn gói một "đội tác chiến" chuyên biệt về Blockchain, giúp các doanh nghiệp Web2 chuyển đổi sang Web3 nhanh chóng và tối ưu chi phí.

## Định hướng 2026: Bùng nổ cùng UniFest và UEF

Khép lại bài thuyết trình, Founder Terran cũng hé lộ kế hoạch lớn nhất trong năm 2026 của Corelia: **Sự kiện UniFest 2026** [08:48]. Hợp tác chiến lược cùng trường Đại học Kinh tế – Tài chính (UEF) – một trong những đơn vị giáo dục cởi mở và tiên phong nhất về tài sản số. UniFest dự kiến sẽ liên kết mạng lưới hơn 10 trường đại học, thu hút hơn 2.000 sinh viên tham gia, trở thành bệ phóng cho những thế hệ Web3 Builder tiếp theo.

---

**Đã đến lúc nâng cấp bản thân từ một "Coder" thành một "Web3 Product Builder".**

- Tìm hiểu thêm chi tiết về mô hình và lộ trình đào tạo trong **Sách trắng (Whitepaper):** [Tải Whitepaper Corelia Academy](https://corelia.academy/CoreliaAcademy_VI.pdf) [09:40].
- Sẵn sàng thực chiến? **[Liên hệ với chúng tôi](/contact)** ngay hôm nay!
$md$),
('vi', 'khep-lai-hanh-trinh-ky-su-web3-sui-blockchain-demo-day-2026', 'khep-lai-hanh-trinh-ky-su-web3-sui-blockchain-demo-day-2026', 'blog', 'published', $md$Khép Lại Hành Trình Kỹ Sư Web3 – Sui Blockchain: 14 Đội Bùng Nổ Tại Demo Day$md$, $md$Buổi 5 chương trình Kỹ sư Web3 – Sui Blockchain tại ITC khép lại bằng Hackathon Web3 Builders và Demo Day với 14 đội thi, mở ra cơ hội internship và đấu trường liên trường cho sinh viên.$md$, 'corelia-team', 'career-ecosystem-insights', ARRAY['web3','move-language','dapp-development','project-based','hackathon','career-tips']::text[], '{"type":"image","src":"/blog/corelia-itc-demoday-2026/corelia-itc-demoday-1.png","alt":"Web3 Builders Demo Day với 14 đội thi tại ITC","fit":"cover"}'::jsonb, '2026-05-13'::date, '2026-05-13'::timestamptz, '2026-05-13'::timestamptz, $md$Hành trình **“Kỹ sư Web3 – Sui Blockchain”** tại ITC đã chính thức khép lại bằng một Buổi 5 đầy năng lượng với **Hackathon “Web3 Builders”** và **Demo Day báo cáo đồ án**. Sau quá trình học tập, thực hành và phát triển sản phẩm, 14 đội thi đã cùng bước lên sân khấu để giới thiệu những ý tưởng Web3 do chính mình xây dựng.

Nếu các buổi học trước đưa sinh viên đi từ Smart Contract với Sui Move, tạo Token đến xây dựng giao diện dApp và kết nối ví, Demo Day là thời điểm toàn bộ kiến thức ấy được kết nối trong một sản phẩm hoàn chỉnh. Đây không còn là bài tập riêng lẻ, mà là kết quả của tư duy công nghệ, khả năng phối hợp và tinh thần “thực chiến” được hình thành xuyên suốt chương trình.

Bạn có thể xem lại [hành trình đào tạo Kỹ sư Web3 tại ITC](/vi/blog/corelia-trien-khai-chuong-trinh-dao-tao-ky-su-web3-tai-itc-2026) để hiểu cách các đội đã chuẩn bị cho chặng Demo Day này.

## 1. Buổi 5 – Điểm Kết Của Một Hành Trình, Điểm Khởi Đầu Của Những Builder

![Toàn cảnh Web3 Builders Demo Day với 14 đội thi tại ITC](/blog/corelia-itc-demoday-2026/corelia-itc-demoday-2.png)

Buổi 5 đánh dấu cột mốc quan trọng nhất của chương trình đào tạo thực hành **“Kỹ sư Web3 – Sui Blockchain”**. Thay vì tiếp tục tiếp nhận kiến thức theo từng chủ đề, sinh viên bước vào vai trò của những builder: xác định bài toán, hoàn thiện giải pháp, kiểm tra sản phẩm và trình bày kết quả trước hội đồng đánh giá.

Hai hoạt động chính của buổi học cuối được kết nối chặt chẽ với nhau:

- **Hackathon “Web3 Builders”** tạo môi trường để các đội tập trung phát triển và hoàn thiện sản phẩm trong tinh thần thi đấu.
- **Demo Day báo cáo đồ án** là nơi sinh viên giới thiệu ý tưởng, cách tiếp cận, sản phẩm đã xây dựng và những giá trị mà giải pháp hướng đến.

Sự kết hợp giữa Hackathon và Demo Day giúp người học trải nghiệm một quy trình gần với môi trường phát triển sản phẩm thực tế. Một ý tưởng chỉ thực sự có sức thuyết phục khi đội ngũ có thể biến nó thành giải pháp hoạt động được, giải thích rõ cách sản phẩm vận hành và cho người khác nhìn thấy tiềm năng phát triển tiếp theo.

## 2. 14 Đội Thi, 14 Hành Trình Biến Ý Tưởng Thành Sản Phẩm
![Toàn cảnh Web3 Builders Demo Day với 14 đội thi tại ITC](/blog/corelia-itc-demoday-2026/corelia-itc-demoday-3.png)

Sau quá trình học tập và xây dựng sản phẩm, **14 đội thi** đã mang đến Demo Day những ý tưởng và ứng dụng Web3 giàu tính sáng tạo. Mỗi phần trình bày là kết quả của nhiều vòng thảo luận, thử nghiệm, viết code, xử lý lỗi và điều chỉnh sản phẩm trong giới hạn thời gian của chương trình.

Không chỉ thể hiện kiến thức công nghệ, các đội còn cho thấy khả năng nhìn nhận vấn đề và tổ chức công việc. Để đi từ ý tưởng ban đầu đến một sản phẩm có thể demo, sinh viên phải kết nối nhiều năng lực khác nhau:

- Xác định vấn đề và nhóm người dùng mà sản phẩm hướng đến.
- Lựa chọn những tính năng cốt lõi có thể hoàn thành trong phạm vi cho phép.
- Xây dựng logic Smart Contract và xử lý dữ liệu trên Sui Blockchain.
- Phát triển giao diện dApp để người dùng có thể tương tác với sản phẩm.
- Phân chia vai trò, phối hợp tiến độ và giải quyết những vấn đề phát sinh.
- Chuẩn bị phần demo, thuyết trình ý tưởng và phản hồi câu hỏi từ hội đồng.

Chính quá trình này đã biến Demo Day thành một cột mốc năng lực cụ thể. Sinh viên không chỉ nói rằng mình đã học Web3, mà có thể trực tiếp trình bày một sản phẩm và giải thích những quyết định kỹ thuật, sản phẩm đằng sau nó.

## 3. Tinh Thần “Thực Chiến” Được Thể Hiện Trên Sân Khấu Demo Day

![Toàn cảnh Web3 Builders Demo Day với 14 đội thi tại ITC](/blog/corelia-itc-demoday-2026/corelia-itc-demoday-4.png)

Điểm nổi bật của Demo Day không chỉ nằm ở số lượng đội thi, mà còn ở tinh thần sẵn sàng thử sức của sinh viên. Với nhiều bạn, đây là lần đầu tiên phải trình bày một sản phẩm Web3 trước chuyên gia và doanh nghiệp. Áp lực của thời gian, chất lượng kỹ thuật và phần thuyết trình khiến mỗi đội phải làm việc với mức độ tập trung cao hơn một bài tập thông thường.

Trong môi trường ấy, những kỹ năng tưởng như tách biệt bắt đầu bổ trợ cho nhau. Kiến thức lập trình giúp sản phẩm vận hành; tư duy sản phẩm giúp đội ngũ lựa chọn đúng vấn đề; kỹ năng teamwork giữ các phần việc đi cùng một hướng; còn khả năng thuyết trình giúp giá trị của giải pháp được truyền đạt rõ ràng.

Tinh thần “thực chiến” cũng thể hiện ở cách sinh viên đối diện với những giới hạn. Không phải ý tưởng nào cũng có thể hoàn thiện tất cả tính năng trong một lần phát triển. Các đội phải học cách ưu tiên, tinh gọn phạm vi, xử lý lỗi và đưa ra một phiên bản đủ rõ ràng để kiểm chứng. Đây là trải nghiệm quan trọng đối với bất kỳ ai muốn bước vào môi trường phát triển sản phẩm công nghệ.

## 4. Từ Đồ Án Đến Cơ Hội Internship

![Toàn cảnh Web3 Builders Demo Day với 14 đội thi tại ITC](/blog/corelia-itc-demoday-2026/corelia-itc-demoday-6.png)

Demo Day không chỉ là hoạt động tổng kết khóa học. Kết quả thể hiện của sinh viên còn mở ra cơ hội kết nối trực tiếp với hệ sinh thái và doanh nghiệp. Từ quá trình theo dõi, đánh giá sản phẩm và năng lực của từng cá nhân, **Sui sẽ xem xét tuyển chọn những sinh viên phù hợp để tham gia chương trình internship**.

Cơ hội này giúp rút ngắn khoảng cách giữa học tập và nghề nghiệp. Thay vì chỉ gửi một bảng điểm hoặc danh sách môn học, sinh viên có thể chứng minh khả năng qua sản phẩm, cách làm việc với đồng đội và quá trình giải quyết vấn đề trong thực tế.

Đối với người học, một đồ án Web3 hoàn chỉnh cũng là nền tảng có giá trị để tiếp tục phát triển portfolio. Sản phẩm có thể được cải tiến sau chương trình, bổ sung tính năng, nâng cấp trải nghiệm hoặc trở thành điểm khởi đầu cho những dự án mới trong tương lai.

## 5. Sáu Đội Xuất Sắc Tiến Đến Đấu Trường Liên Trường

![Toàn cảnh Web3 Builders Demo Day với 14 đội thi tại ITC](/blog/corelia-itc-demoday-2026/corelia-itc-demoday-7.png)

Sau quá trình chấm điểm đồ án, **6 đội có kết quả xuất sắc nhất** sẽ được **Khoa CNTT–ĐT** dẫn dắt tham gia thi đấu liên trường cùng sinh viên từ các trường Cao đẳng và Đại học khác.

Chặng đường mới này mang đến một thử thách lớn hơn. Các đội không chỉ cần tiếp tục hoàn thiện chất lượng kỹ thuật, mà còn phải làm rõ hơn bài toán, giá trị khác biệt và khả năng ứng dụng của sản phẩm. Khi bước ra khỏi phạm vi lớp học, mỗi giải pháp sẽ được đặt cạnh nhiều góc nhìn, cách tiếp cận và ý tưởng đến từ những môi trường đào tạo khác nhau.

Cuộc thi liên trường vì thế không đơn thuần là vòng thi tiếp theo. Đây còn là cơ hội để sinh viên giao lưu với cộng đồng builder rộng hơn, học hỏi từ những sản phẩm khác và nhìn thấy tiêu chuẩn cần hướng đến nếu muốn tiếp tục phát triển trong lĩnh vực Web3.

## 6. Giá Trị Vượt Ra Ngoài Một Khóa Học Công Nghệ

![Toàn cảnh Web3 Builders Demo Day với 14 đội thi tại ITC](/blog/corelia-itc-demoday-2026/corelia-itc-demoday-8.png)

“Kỹ sư Web3 – Sui Blockchain” không chỉ giới thiệu một xu hướng công nghệ mới. Chương trình tạo ra một lộ trình để sinh viên đi từ tiếp cận kiến thức đến tự tay xây dựng và trình diễn sản phẩm.

Qua hành trình này, sinh viên có cơ hội:

- **Tiếp cận Web3 và Blockchain hiện đại** thông qua nền tảng Sui và ngôn ngữ Move.
- **Học và làm việc trực tiếp cùng chuyên gia, doanh nghiệp**, từ đó hiểu thêm yêu cầu của môi trường công nghệ thực tế.
- **Xây dựng sản phẩm thật**, thay vì chỉ dừng lại ở bài tập lý thuyết hoặc ví dụ có sẵn.
- **Trải nghiệm quy trình làm việc theo nhóm**, từ lên ý tưởng, phân vai đến hoàn thiện và demo sản phẩm.
- **Mở rộng cơ hội nghề nghiệp** ngay khi còn ngồi trên ghế nhà trường thông qua sản phẩm, portfolio và kết nối hệ sinh thái.

Quan trọng hơn, chương trình giúp sinh viên hình thành tư duy chủ động. Công nghệ luôn thay đổi, nhưng khả năng tự học, thử nghiệm, cộng tác và biến kiến thức thành kết quả cụ thể sẽ tiếp tục đồng hành cùng các bạn trong nhiều chặng đường nghề nghiệp sau này.

## 7. Kết Nối Nhà Trường, Đơn Vị Triển Khai Và Hệ Sinh Thái Web3

![Toàn cảnh Web3 Builders Demo Day với 14 đội thi tại ITC](/blog/corelia-itc-demoday-2026/corelia-itc-demoday-9.png)

Chương trình do **Corelia triển khai tại ITC**, với sự phối hợp của nhà trường và sự đồng hành chuyên môn từ **Sui, CommandOSS cùng các chuyên gia trong lĩnh vực Blockchain**. Toàn bộ hành trình được xây dựng theo định hướng **“Thực hành – Thực chiến – Gắn doanh nghiệp”**.

Sự kết nối này giúp nội dung đào tạo không tách rời nhu cầu thực tế. Nhà trường tạo nền tảng và môi trường học tập; Corelia xây dựng, triển khai hành trình thực hành; các đơn vị và chuyên gia trong hệ sinh thái mang đến góc nhìn công nghệ, kinh nghiệm sản phẩm và cơ hội phát triển tiếp theo cho sinh viên.

Từ những buổi học đầu tiên đến Demo Day, mục tiêu xuyên suốt không phải là học thật nhiều thuật ngữ, mà là giúp sinh viên có thể **làm ra một sản phẩm, trình bày được sản phẩm và sẵn sàng bước tiếp**.

## Lời Kết

![Toàn cảnh Web3 Builders Demo Day với 14 đội thi tại ITC](/blog/corelia-itc-demoday-2026/corelia-itc-demoday-12.png)

Xin chúc mừng cả **14 đội thi** đã hoàn thành một hành trình nhiều thử thách nhưng cũng đầy dấu ấn. Mỗi sản phẩm được trình diễn tại Demo Day là kết quả của sự kiên trì, tinh thần đồng đội và quyết tâm bước ra khỏi vùng an toàn để chinh phục một lĩnh vực công nghệ mới.

Buổi 5 đã khép lại chương trình **“Kỹ sư Web3 – Sui Blockchain”**, nhưng hành trình của những builder trẻ chỉ vừa mở ra. Phía trước là cơ hội internship, chặng thi đấu liên trường và nhiều không gian hơn để các đội tiếp tục hoàn thiện sản phẩm của mình.

Hẹn gặp lại tại đấu trường liên trường, nơi những ý tưởng Web3 sẽ tiếp tục được thử thách, nâng cấp và bùng nổ mạnh mẽ hơn nữa.
$md$),
('vi', 'move-bootcamp-on-campus-1-viet-my-college', 'move-bootcamp-on-campus-1-viet-my-college', 'blog', 'published', $md$Nhìn Lại Sự Kiện "Move Bootcamp on Campus #1": Khởi Động Hành Trình Chinh Phục Sui Tại Cao Đẳng Việt Mỹ$md$, $md$Tổng kết Move Bootcamp on Campus #1 tại Cao Đẳng Việt Mỹ (14/11/2025): từ nền tảng DLT, Blockchain, Smart Contract đến thực hành Sui CLI, Sui Wallet và Mini quiz, cùng dàn diễn giả Sui Foundation và First Movers Vietnam.$md$, 'terran', 'career-ecosystem-insights', ARRAY['web3','blockchain-fundamentals','move-language','tooling','ecosystem','career-tips']::text[], '{"type":"image","src":"/blog/NVA04774.JPG","alt":"Move Bootcamp on Campus #1 - Cao Đẳng Việt Mỹ, Cơ sở Trung Sơn","ogSrc":"/blog/og/NVA04774.JPG"}'::jsonb, '2025-11-14'::date, '2025-11-14'::timestamptz, '2025-11-14'::timestamptz, $md$Sáng ngày 14/11/2025, "chuyến xe" Sui Learning Tour đã chính thức đổ bộ tại Trường Cao Đẳng Việt Mỹ (Cơ sở Trung Sơn, Bình Chánh) với sự kiện "Move Bootcamp on Campus #1". Thu hút gần 100 sinh viên và lập trình viên trẻ tham dự, đây chính là "phát súng" mở màn đầy hứng khởi cho chuỗi chương trình huấn luyện chuyên sâu "Sui & Move Bootcamp" tại Việt Nam.

## 1. Xây Dựng Nền Tảng – Bước Đệm Đầu Tiên Bước Vào Thế Giới Web3

![Move Bootcamp on Campus #1 - Khai mạc tại Cao Đẳng Việt Mỹ, Cơ sở Trung Sơn](/blog/NVA04544.JPG)

Khác với các buổi hội thảo thông thường, Move Bootcamp on Campus #1 được thiết kế như một lớp học nền tảng, đưa các bạn sinh viên đi từ những khái niệm cốt lõi nhất của công nghệ Sổ cái phân tán (DLT) và Blockchain, cho đến cách thức vận hành của Smart Contract và ứng dụng phi tập trung (DApp).

Đặc biệt, người tham dự đã được "mục sở thị" kiến trúc đột phá của hệ sinh thái Sui – một nền tảng blockchain thế hệ mới nổi bật với cơ chế xử lý giao dịch song song và mô hình lưu trữ dữ liệu dạng đối tượng (object-based) vô cùng tối ưu.

## 2. Sự Đồng Hành Của Dàn Chuyên Gia Dày Dày Kinh Nghiệm

![Các diễn giả tại Move Bootcamp on Campus #1 - Cao Đẳng Việt Mỹ](/blog/NVA04498.JPG)

Xuyên suốt 3 giờ đồng hồ của chương trình, các bạn sinh viên đã được dẫn dắt và truyền cảm hứng bởi đội ngũ diễn giả, chuyên gia uy tín trong hệ sinh thái:

- **Anh Thái Phạm Ngọc Tường**: Developer Ambassador, Sui Foundation & Founder, Corelia Academy
- **Anh Trần Tiến Phát**: Developer Ambassador, Sui Foundation
- **Anh Nguyễn Hà Phúc**: Developer Ambassador, Sui Foundation
- **Anh Phan Hoàng Vinh Hiển**: Developer Relations, First Movers Việt Nam

Nhờ sự hướng dẫn tận tình từ các diễn giả, những khái niệm công nghệ phức tạp đã được truyền tải một cách trực quan, dễ hiểu và gần gũi nhất với sinh viên.

## 3. Trải Nghiệm "Thực Chiến": Cài Đặt Tooling & Tương Tác On-chain

Điểm nhấn khác biệt của buổi Bootcamp #1 chính là phần Hands-on Session (Thực hành trực tiếp). Không chỉ dừng lại ở lý thuyết, các bạn sinh viên đã tự tay:

- **Cài đặt** thành công bộ công cụ Sui CLI và tạo ví Sui Wallet.
- **Thực hiện** các thao tác tương tác đầu tiên với mạng lưới mạng thử nghiệm (Sui Testnet).
- **Tham gia** tranh tài sôi nổi trong Mini quiz "Hiểu nhanh về Sui" để rinh về những phần quà hấp dẫn từ ban tổ chức.

Ngoài ra, các bạn tham gia còn nhận được Chứng nhận hoàn thành buổi học, đồng thời nắm trong tay tấm vé bước tiếp vào các giai đoạn sau của Bootcamp – nơi đỉnh cao là cuộc thi Mini Hackathon Demo Day.

## 4. Lời Kết

Move Bootcamp on Campus #1 tại Cao Đẳng Việt Mỹ đã khép lại thành công, hoàn thành xuất sắc nhiệm vụ đặt những viên gạch nền móng đầu tiên cho các nhà phát triển tương lai. Buổi học đã giúp sinh viên vượt qua rào cản công cụ ban đầu, sẵn sàng tâm thế để bước vào những buổi học tiếp theo: trực tiếp viết code với ngôn ngữ Move và tự tay xây dựng DApp thực tế.

Xin cảm ơn Trường Cao Đẳng Việt Mỹ và toàn thể các bạn sinh viên đã tạo nên một khởi đầu bùng nổ. Hãy về nhà ôn tập, giữ vững tinh thần nhiệt huyết này và chuẩn bị sẵn sàng cho những thử thách lập trình cam go hơn ở các buổi Bootcamp tiếp theo nhé!
$md$),
('vi', 'solana-developer-bootcamp-hanh-trinh-builder-co-cau-truc', 'solana-developer-bootcamp-structured-builder-journey', 'case-study', 'published', $md$Solana Developer Bootcamp: Biến Một Tech Stack Phức Tạp Thành Hành Trình Builder Có Cấu Trúc$md$, $md$Cách Corelia chuyển hóa tech stack Solana phức tạp thành lộ trình tuần tự, từ kiến trúc và program logic đến kiểm thử, triển khai và một sản phẩm on-chain hoạt động được.$md$, 'corelia-team', 'community-success-stories', ARRAY['web3','smart-contracts','dapp-development','mentorship','project-based','tooling']::text[], '{"type":"image","src":"/blog/corelia-unihackfest-unitour-van-hien-solana-2026/_DSC3696.jpg","alt":"Buổi đào tạo Solana developer của Corelia Academy","fit":"cover"}'::jsonb, '2026-08-25'::date, '2026-08-25'::timestamptz, '2026-08-25'::timestamptz, $md$**Đào tạo Developer · Hệ sinh thái Solana**

Học Solana không khó vì developer thiếu tài liệu. Nó khó bởi có quá nhiều khái niệm cần đồng thời kết nối với nhau.

Một developer cần hiểu wallet, account, transaction, program, token, PDA, Anchor, testing, tích hợp frontend, Devnet, deployment và debugging trước khi từng mảnh ghép riêng lẻ trở thành một quy trình phát triển hoàn chỉnh.

Corelia Academy thiết kế Solana Developer Bootcamp để chuyển hóa sự phức tạp đó thành một hành trình học tập tuần tự. Mục tiêu không phải giúp người học ghi nhớ thuật ngữ Solana, mà là giúp họ **xây dựng một sản phẩm thực sự hoạt động**.

## Bài Toán

Đào tạo developer thường gặp hai vấn đề.

Thứ nhất là **lý thuyết nhưng không thể thực thi**. Người học hiểu smart contract hoặc account là gì, nhưng gặp khó khi phải tự xây dựng, kiểm thử, kết nối và triển khai ứng dụng.

Thứ hai là **thực thi nhưng thiếu hiểu biết nền tảng**. Người học làm theo tutorial, clone repository, thay đổi vài dòng code và tạo ra thứ có thể chạy mà chưa xây dựng được mental model đáng tin cậy về lý do nó hoạt động.

Cả hai cách tiếp cận đều trở nên khó khăn khi có lỗi. Một transaction thất bại, PDA không chính xác, account constraint, lỗi kết nối ví hoặc deployment có thể nhanh chóng khiến người chỉ biết “happy path” phải dừng lại.

Giáo trình của Corelia được thiết kế quanh một câu hỏi khác: **Developer cần hiểu điều gì để có thể tự xây dựng sau khi khóa học kết thúc?**

## Cách Tiếp Cận Của Corelia

![Sinh viên khám phá tech stack phát triển Solana](/blog/corelia-unihackfest-unitour-van-hien-solana-2026/_DSC3620.jpg)

Bootcamp áp dụng phương pháp build-first, đồng thời chủ động giảng dạy mental model phía sau code. Trình tự học tập đi từ:

**Nền tảng → Kiến trúc → Program Logic → Kiểm thử → Ứng dụng → Triển khai**

Trước khi làm việc với ứng dụng lớn, người học hiểu execution model của Solana. Họ tìm hiểu mối quan hệ giữa wallet và account, cách transaction chứa instruction, cách program tương tác với trạng thái account, cũng như PDA và quyền hạn. Chỉ sau đó, độ phức tạp của sản phẩm mới được tăng dần.

Solana Development track được công bố cho UniHackFest là một cách triển khai kiến trúc này: lộ trình kỹ thuật bốn tuần gồm 10 module và 40 bài học, được hỗ trợ bởi các buổi kỹ thuật trực tiếp và mentor office hours. Nội dung đi từ nền tảng hệ sinh thái và account đến transaction, token, program, Anchor, tích hợp frontend, Devnet và capstone.

## Học Bằng Cách Xây Dựng, Không Chỉ Quan Sát

Corelia xem code là thứ người học cần tự xây, đặt câu hỏi, kiểm thử và chủ động làm hỏng. Một vòng học điển hình gồm:

**Khái niệm → Sơ đồ → Code → Kiểm thử**

Đầu tiên, người học hiểu khái niệm. Sau đó, kiến trúc được trực quan hóa qua quan hệ account, luồng transaction hoặc cấu trúc program. Tiếp theo, họ triển khai logic. Cuối cùng, họ chứng minh implementation hoạt động đúng.

Điều này đặc biệt quan trọng trong phát triển blockchain vì frontend chỉ là một phần của hệ thống. Một sản phẩm hoạt động có thể cần sự phối hợp giữa tương tác ví, trạng thái program, cấu trúc transaction, xử lý lỗi và hoạt động on-chain có thể kiểm chứng. Vì vậy, người học tiến từ bài tập riêng lẻ đến một ứng dụng hoàn chỉnh.

## Từ Nền Tảng Đến Full-Stack Solana

### Hiểu Mental Model Của Solana

Người học bắt đầu với những khái niệm khiến Solana khác biệt với phát triển ứng dụng truyền thống: account, instruction, program, thực thi transaction, wallet, phí và trạng thái on-chain.

### Xây Dựng Program Logic

Khi đã có mental model, sinh viên chuyển sang phát triển program bằng Rust và Anchor. Họ học cách tư duy về state, instruction, PDA, signer, account constraint và tương tác giữa program thay vì xem smart contract như một “hộp đen”.

### Làm Việc Với Tài Sản Số

Token và tài sản on-chain tạo ra bối cảnh thực tế để người học áp dụng account model, quyền hạn, chuyển tài sản và trạng thái do program kiểm soát.

### Kiểm Thử Sản Phẩm

Testing được xem là một phần của quá trình phát triển, không phải bước tùy chọn trước khi nộp bài. Người học phân tích state transition kỳ vọng, failure case, ranh giới phân quyền và hành vi transaction.

### Kết Nối Frontend

Tích hợp wallet, luồng transaction phía client, truy vấn account, trạng thái lỗi và xác minh trên Explorer kết nối blockchain development với trải nghiệm sản phẩm có thể sử dụng.

### Triển Khai Và Trình Diễn

Một hành trình kỹ thuật chỉ thực sự có ý nghĩa khi người khác có thể kiểm chứng kết quả. Trong UniHackFest, lớp học Solana đi đến một dApp trên Devnet có tích hợp wallet và bằng chứng transaction hiển thị trên Explorer.

## Giáo Trình Được Xây Dựng Quanh Đầu Ra

![Hoạt động học tập thực hành trong chương trình campus của Corelia](/blog/unihackfest-unitour-2-dhv-web3-solana-2026/IMG_3102.jpg)

Một trong những quyết định thiết kế quan trọng nhất là không xem hoàn thành khóa học như kết quả chính. Xem hết mọi bài học không đồng nghĩa với khả năng xây dựng.

Corelia thiết kế hành trình xoay quanh những đầu ra có thể trở thành bằng chứng năng lực:

- Một program hoạt động được.
- Một transaction flow đã được kiểm thử.
- Một frontend đã kết nối.
- Một ứng dụng đã triển khai.
- Một public repository.
- Một capstone hoặc working demo.

Những đầu ra này có giá trị vượt khỏi khóa học. Chúng có thể trở thành một phần portfolio, nền tảng kỹ thuật cho dự án hackathon, công cụ để mentor xác định điểm người học đang gặp khó khăn và tín hiệu năng lực đáng tin cậy hơn việc tham dự khóa học đơn thuần.

## Kết Nối Đào Tạo Developer Với Một Builder Pipeline Thực Tế

Solana Bootcamp trở nên mạnh mẽ hơn khi kết nối với môi trường nơi người học có lý do để sử dụng kiến thức. Vì vậy, giáo trình cũng đóng vai trò lớp kỹ thuật của UniHackFest.

Sinh viên không học Solana rồi tự hỏi bước tiếp theo là gì. Họ mang kỹ năng vào hành trình phát triển sản phẩm, nơi họ phải xác định vấn đề, thành lập đội, xây dựng ứng dụng, nhận phản hồi, vượt qua vòng loại và cuối cùng trình diễn sản phẩm.

Trong mô hình UniHackFest, Rust Survival Kit và Solana Bootcamp chuẩn bị cho các đội đi từ ý tưởng đến tích hợp wallet, transaction có thể kiểm chứng và ứng dụng Solana hoạt động được. Điều này thu hẹp khoảng cách quan trọng giữa **đào tạo developer** và **kích hoạt developer**.

## Vai Trò Của Corelia

Corelia thiết kế toàn bộ lớp trải nghiệm học tập kỹ thuật:

**Thiết kế giáo trình · Đào tạo kỹ thuật · Nội dung học tập · Developer Experience · Kiến trúc dự án · Mentorship · Đánh giá · Thiết kế Capstone**

Công việc không chỉ là dịch tài liệu sang tiếng Việt. Nó đòi hỏi quyết định người học nên hiểu gì trước, abstraction nào nên được giới thiệu sau, nơi nào cần bài tập thực hành, độ phức tạp của dự án nên tăng như thế nào, bằng chứng nào thể hiện sự hiểu biết thực sự và giáo trình kết nối ra sao với chặng tiếp theo của hành trình builder.

## Vì Sao Case Study Này Quan Trọng

Những hệ sinh thái developer mạnh cần nhiều hơn tài liệu. Họ cần một con đường xuyên qua kho tài liệu đó.

Solana Developer Bootcamp thể hiện cách Corelia tiếp cận đào tạo developer: chuyển hóa một hệ sinh thái kỹ thuật phức tạp thành trình tự mà người học có thể hiểu, thực hành, kiểm thử và cuối cùng sử dụng độc lập.

Kết quả không chỉ là một khóa blockchain khác. Đây là hệ thống đào tạo developer có thể tái sử dụng cho học trực tuyến, workshop tại đại học, technical bootcamp, hackathon và chương trình phát triển builder của hệ sinh thái.

**Hiểu → Xây dựng → Kiểm thử → Triển khai**

### Corelia Academy

**Biến tech stack thành hành trình học tập dẫn đến những sản phẩm hoạt động được.**
$md$),
('vi', 'sui-learning-tour-gia-dinh-university-2025', 'sui-learning-tour-gia-dinh-university-2025', 'blog', 'published', $md$Nhìn Lại Sự Kiện "Sui Learning Tour x Gia Dinh University 2025": Đánh Thức Đam Mê Web3 Ở Thế Hệ Developer Trẻ$md$, $md$Tổng kết Training Workshop tại GDU (01/11/2025): từ Blockchain Dev Fundamentals, Hackathon Mastery đến Live Coding Move và Slush Wallet Challenge, cùng dàn diễn giả Sui Foundation, OLYM3 và First Movers Vietnam.$md$, 'terran', 'career-ecosystem-insights', ARRAY['web3','blockchain-fundamentals','ecosystem','hackathon','move-language','career-tips']::text[], '{"type":"image","src":"/blog/574601865_1608964343799696_3483529006715381870_n.jpg","alt":"Toàn cảnh khai mạc Sui Learning Tour x Gia Định University 2025 – Hình ảnh khán phòng Workshop rộn ràng sinh viên tham dự.","ogSrc":"/blog/og/574601865_1608964343799696_3483529006715381870_n.jpg"}'::jsonb, '2025-11-01'::date, '2025-11-01'::timestamptz, '2025-11-01'::timestamptz, $md$Vào sáng ngày 01/11/2025, chuyến xe công nghệ mang tên "Sui Learning Tour" đã chính thức đổ bộ tại Trường Đại học Gia Định (GDU), mang đến một buổi Training Workshop bùng nổ và tràn đầy cảm hứng. Sự kiện đã thu hút đông đảo sinh viên, lập trình viên trẻ và những người đam mê công nghệ cùng quy tụ tại Hội trường B để khám phá tiềm năng vô hạn của Blockchain và Web3.

## 1. Hành Trình Lan Tỏa Tri Thức Blockchain Tới GDU

![Quang cảnh mở đầu Sui Learning Tour x Gia Định University 2025 – Sinh viên GDU hứng khởi, sẵn sàng bước vào Workshop](/blog/577026724_1608962507133213_1756685810773723956_n.jpg)

Là một trong những điểm dừng chân quan trọng của chuỗi Sui Learning Tour toàn quốc, sự kiện lần này do **Sui Community** phối hợp cùng **GDU Coder Club** và **First Movers Vietnam** tổ chức.

Không chỉ dừng lại ở những lý thuyết khô khan, workshop kéo dài 4 tiếng này được thiết kế như một bệ phóng thực sự, giúp các bạn sinh viên GDU tiếp cận với hệ sinh thái Sui – một nền tảng blockchain hiệu năng cao và vô cùng thân thiện với các nhà phát triển. Đây là bước đệm hoàn hảo để thế hệ lập trình viên trẻ chuyển mình từ "truyền thống" sang không gian Web3 đầy triển vọng.

## 2. Dấu Ấn Chuyên Sâu Từ Dàn Diễn Giả "Khủng"

![Các diễn giả chia sẻ chuyên sâu tại Workshop – Không khí hăng say tập trung tại Sui Learning Tour x GDU](/blog/576202541_1608964237133040_4776484432963071892_n.jpg)

Một trong những điểm sáng lớn nhất của sự kiện chính là hàm lượng kiến thức chuyên môn sâu sắc được truyền tải bởi các chuyên gia hàng đầu trong ngành. Khán giả đã được dẫn dắt qua nhiều chủ đề hấp dẫn:

- **Blockchain Dev Fundamentals & Career Opportunities:** Nắm bắt tư duy lập trình on-chain/off-chain, tổng quan về ngôn ngữ Move và phân tích cơ hội nghề nghiệp trong kỷ nguyên Web3.
- **Hackathon Mastery:** Bí kíp từ các đội top-tier về cách lên ý tưởng, quản lý thời gian và "pitching" (thuyết trình) dự án hiệu quả.

Sự kiện vinh dự có sự góp mặt và chia sẻ từ:

- **Anh Thái Phạm Ngọc Tường** – Developer Ambassador, Sui Foundation & Founder, Corelia Academy.
- **Anh Mai Thanh Nhã** – Giám đốc công ty OLYM3, Chainlink Developer Expert.
- **Anh Phan Hoàng Vinh Hiển** – Developer Relations, First Movers Vietnam.
- **Anh Nguyễn Hà Phúc** – Developer Ambassador, Sui Foundation.

## 3. Thực Chiến Sôi Nổi & Đặc Quyền Hấp Dẫn

![Sinh viên GDU thực hành code cùng diễn giả tại Workshop, không khí tích cực và tương tác cao](/blog/574911557_1608962587133205_1420610341953389485_n.jpg)

Khác biệt với những buổi hội thảo thông thường, Sui Learning Tour x GDU mang đậm tính thực hành và tương tác:

- **Live Coding Session:** Sinh viên được tận mắt theo dõi và hướng dẫn cách xây dựng, triển khai, kiểm thử một smart contract (hợp đồng thông minh) cơ bản bằng ngôn ngữ Move ngay trên mạng thử nghiệm Sui.
- **Mini-game "Slush Wallet Challenge":** Bầu không khí hội trường thực sự nóng lên khi các bạn tham gia trải nghiệm ví Slush với các thử thách on-chain trực tiếp, qua đó rinh về những phần thưởng giá trị bằng token SUI.

Đặc biệt, những bạn tham gia trọn vẹn chương trình còn nhận được **Giấy chứng nhận hoàn thành workshop**, một điểm cộng tuyệt vời cho hồ sơ năng lực sau này, đồng thời mở ra cánh cửa tham gia các dự án và Hackathon lớn của hệ sinh thái Sui.

## 4. Lời Kết

Sui Learning Tour x Gia Dinh University 2025 đã diễn ra thành công tốt đẹp, vượt xa kỳ vọng của một buổi workshop thông thường. Đây thực sự là nơi kết nối cộng đồng developer Web3, nơi những ý tưởng ban sơ được ươm mầm để trở thành những dApp đột phá trong tương lai.

Xin gửi lời cảm ơn chân thành đến ban giám hiệu Trường Đại học Gia Định, GDU Coder Club, First Movers Vietnam và toàn thể các bạn sinh viên đã góp phần làm nên thành công của sự kiện.

Hãy tiếp tục trau dồi ngôn ngữ Move và đừng quên theo dõi Sui Community để cập nhật những hoạt động, khóa học và cơ hội Hackathon sắp tới nhé! Cùng nhau, chúng ta sẽ xây dựng tương lai Web3 vững mạnh tại Việt Nam!
$md$),
('vi', 'sui-learning-tour-huit-2026', 'sui-learning-tour-huit-2026', 'blog', 'published', $md$Hơn 220 Sinh Viên Công Thương Cùng Sui Learning Tour Khai Phóng Web3$md$, $md$Kick-off Sui Learning Tour tại Đại học Công Thương TP.HCM thu hút hơn 220 sinh viên: từ nền tảng Blockchain & Sui, cơ hội nghề nghiệp đến tư duy Hackathon thực chiến.$md$, 'terran', 'career-ecosystem-insights', ARRAY['web3','blockchain-fundamentals','ecosystem','hackathon','move-language','career-tips']::text[], '{"type":"image","src":"/blog/sui-huit.jpg","alt":"Sui Learning Tour x HUIT 2026 - Kick-off tại Đại học Công Thương TP.HCM","ogSrc":"/blog/og/sui-huit.jpg"}'::jsonb, '2026-01-01'::date, '2026-01-01'::timestamptz, '2026-01-01'::timestamptz, $md$Hơn 220 sinh viên và lập trình viên trẻ đã lấp kín hội trường Trường Đại học Công Thương TP.HCM (HUIT) trong buổi Kick-off mở màn Sui Learning Tour 2026. Sui Foundation phối hợp cùng HUIT và First Movers Vietnam chọn mô hình **Học – Làm – Kiểm chứng – Kết nối**, biến buổi đầu tiên thành bước đệm vững chắc trước các đợt Bootcamp và Mini Hackathon sắp tới.

## 1. Nền Tảng Trước Khi Viết Code

![Sui Learning Tour x HUIT 2026 - Diễn giả trình bày nền tảng Blockchain tại Đại học Công Thương](/blog/sui-huit-1.jpg)

Thay vì hội thảo thuần lý thuyết, chương trình tập trung xây nền tảng tư duy: sinh viên hiểu rõ hệ sinh thái Blockchain và Sui trước khi đụng tới những dòng code phức tạp. Đây là cách HUIT và đối tác thiết kế pipeline bền vững: từ developer trẻ đến project, Hackathon và cơ hội Grant hoặc nghề nghiệp.

## 2. Bốn Trụ Cột Kiến Thức Trong Một Buổi

![Sui Learning Tour x HUIT 2026 - Khán giả tại Đại học Công Thương](/blog/sui-huit-2.jpg)

Cả hội trường được dẫn dắt qua bốn mảng nội dung then chốt:

- **Giải mã Blockchain & Web3:** Smart Contract, Wallet, Token, NFT và sự dịch chuyển từ Web2 sang thế giới phi tập trung.

- **Tổng quan Sui Blockchain:** Kiến trúc Object-centric, sức mạnh bảo mật của Move, và các ứng dụng thực tế đang dẫn đầu thị trường: DeFi, GameFi, DePIN.

- **Kinh tế số & cơ hội nghề nghiệp:** Góc nhìn toàn cảnh về vai trò Blockchain trong chuyển đổi số, vị trí việc làm tiềm năng và lộ trình thăng tiến cho sinh viên CNTT.

- **Tư duy Hackathon thực chiến:** Bí quyết từ lên ý tưởng, phân vai làm việc nhóm đến kỹ năng "build nhanh – demo rõ" để thuyết phục ban giám khảo.

## 3. Lộ Trình 2026 Đã Được Kích Hoạt

![Sui Learning Tour x HUIT 2026 - Khoảnh khắc trình bày tại Đại học Công Thương](/blog/sui-huit-3.jpg)

Kết thúc Kick-off, lộ trình đào tạo tiếp theo đã rõ: **Sui x AI Bootcamp** (AI hỗ trợ học và viết code), **Mini Hackathon & Demo Day** (kiểm chứng năng lực thực tế), và cơ hội giải thưởng Hackathon cùng Grant từ hệ sinh thái Sui toàn cầu. Sinh viên HUIT đã sẵn sàng tâm thế cho chặng đường phía trước.

## 4. Kết

Buổi Kick-off tại HUIT khép lại với hơn 220 bạn trẻ: minh chứng rõ ràng cho sức hút Web3 tại giảng đường và thế hệ developer tương lai sẵn sàng nắm bắt công nghệ. Cảm ơn Đại học Công Thương TP.HCM và toàn thể sinh viên đã tạo nên sự kiện đáng nhớ; hẹn gặp lại ở các vòng Bootcamp sắp tới.
$md$),
('vi', 'sui-learning-tour-tu-nhan-biet-den-student-builder', 'sui-learning-tour-campus-awareness-to-student-builders', 'case-study', 'published', $md$Sui Learning Tour: Từ Nhận Biết Tại Trường Đến Những Student Builder Thực Thụ$md$, $md$Cách Corelia chuyển hoạt động tiếp cận đại học cho hệ sinh thái Sui thành hành trình có thể lặp lại, từ khám phá và đào tạo bản địa hóa đến sản phẩm, Demo Day và cơ hội phát triển tiếp theo.$md$, 'corelia-team', 'community-success-stories', ARRAY['web3','move-language','dapp-development','ecosystem','mentorship','project-based']::text[], '{"type":"image","src":"/blog/sui-huit.jpg","alt":"Sui Learning Tour cùng sinh viên đại học Việt Nam","fit":"cover","ogSrc":"/blog/og/sui-huit.jpg"}'::jsonb, '2026-08-25'::date, '2026-08-25'::timestamptz, '2026-08-25'::timestamptz, $md$**Đào tạo Developer tại Đại học · Hệ sinh thái Sui**

Giới thiệu một hệ sinh thái blockchain đến sinh viên đại học là điều tương đối dễ. Giúp những sinh viên đó trở thành builder mới là bài toán khó hơn nhiều.

Sui Learning Tour trở thành một trong những thử nghiệm quy mô lớn đầu tiên của Corelia Academy nhằm giải quyết bài toán này. Thay vì xem hoạt động tiếp cận đại học như chuỗi sự kiện giới thiệu đơn lẻ, chương trình xây dựng một lộ trình để sinh viên khám phá Sui, học Move và phát triển on-chain, xây dựng ứng dụng, tham gia Mini Hackathon, trình bày dự án và tiếp tục tiến vào những cơ hội lớn hơn trong hệ sinh thái.

Mô hình được phát triển thành hành trình đơn giản: **Khám phá → Học → Xây dựng → Demo → Tiếp tục**.

## Bài Toán

Các hệ sinh thái công nghệ mới thường bước vào trường đại học theo một format quen thuộc: diễn giả giới thiệu công nghệ, sinh viên lắng nghe, mọi người chụp ảnh và sự kiện kết thúc.

Cách làm này có thể tạo nhận biết, nhưng nhận biết đơn thuần không tạo ra developer. Với sinh viên lần đầu tiếp cận blockchain, khoảng cách từ việc nghe nói về Sui đến xây dựng một ứng dụng hoạt động được là rất lớn.

Các bạn cần kiến thức blockchain nền tảng, cần hiểu Sui khác các kiến trúc khác như thế nào, cần học Move, thực hành kỹ thuật, có lý do để tiếp tục xây dựng và cuối cùng là một nơi để chứng minh những gì mình đã học.

Corelia thiết kế Sui Learning Tour quanh toàn bộ tiến trình đó.

## Cách Tiếp Cận Của Corelia

![Sinh viên học về Sui và kiến thức blockchain nền tảng](/blog/sui-huit-1.jpg)

Chương trình đưa hoạt động đào tạo developer đã được bản địa hóa trực tiếp vào môi trường đại học. Thay vì bắt đầu bằng tài liệu kỹ thuật chuyên sâu, những buổi đầu kết nối kiến thức blockchain nền tảng với Sui, cơ hội nghề nghiệp, tư duy sản phẩm, bảo mật và việc tham gia hackathon.

Sinh viên sau đó có thể tiến đến những hoạt động kỹ thuật sâu hơn về Move, smart contract, wallet, dApp và phát triển thực hành. Những hành trình campus mạnh nhất không dừng ở workshop mà tiếp tục với bootcamp, Mini Hackathon, hoạt động SuiHub Discovery và Demo Day.

Nhờ đó, một trường đại học có thể đi qua nhiều cấp độ tương tác thay vì liên tục nhận cùng một sự kiện giới thiệu.

## 1. Khám Phá

Mục tiêu đầu tiên là giúp hệ sinh thái trở nên dễ hiểu. Sinh viên khám phá kiến thức blockchain nền tảng, kiến trúc Sui, Move, wallet, ứng dụng on-chain và các use case thực tế.

Những bài tổng kết công khai cho thấy mô hình đã tiếp cận nhiều cộng đồng đại học:

- Hơn **200 sinh viên khối kỹ thuật** tham gia workshop tại UTC2.
- Một buổi học tại Đại học Văn Lang quy tụ **gần 140 sinh viên**.
- Buổi kick-off tại HUIT thu hút **hơn 220 sinh viên**.
- Tại UEF, **gần 100 sinh viên** tham gia buổi mở đầu được thiết kế như điểm khởi động của một hành trình dài hơn.

Những con số này có ý nghĩa, nhưng độ phủ chỉ là lớp đầu tiên. Câu hỏi tiếp theo luôn là: **Ai muốn tiếp tục xây dựng?**

## 2. Học

![Buổi Sui Learning Tour tại Đại học Văn Lang](/blog/sui-vanlang-2.jpg)

Với những sinh viên muốn đi xa hơn, Corelia đưa vào nội dung kỹ thuật chuyên sâu. Các hoạt động tại trường tiến từ blockchain nền tảng đến lập trình Move, logic smart contract, wallet, phát triển dApp và quy trình làm việc thực tế.

Chương trình xuất hiện tại các cộng đồng gồm UIT, Đại học Gia Định, UTC2, Cao đẳng Việt Mỹ, Đại học Văn Lang, Đại học Văn Hiến, UEF, HUIT và sau đó là hành trình Kỹ sư Web3 tại ITC. Các bài recap công khai của Corelia ghi lại tiến trình này trong giai đoạn cuối năm 2025 và nửa đầu năm 2026.

Bản địa hóa đóng vai trò quan trọng. Mục tiêu không chỉ là dịch thuật ngữ kỹ thuật, mà là giảng dạy khái niệm theo một trình tự phù hợp với sinh viên có thể đã có nền tảng lập trình tốt nhưng ít tiếp xúc với blockchain hoặc Move.

## 3. Xây Dựng

Chương trình trở nên giá trị hơn đáng kể khi sinh viên không còn là khán giả mà bắt đầu trở thành developer.

Các buổi thực hành yêu cầu người học trực tiếp làm việc với công nghệ. Sinh viên đi từ hiểu smart contract đến tự tạo smart contract; từ thảo luận về wallet đến tích hợp wallet; từ nghe về dApp đến xây giao diện quanh logic on-chain; từ làm theo ví dụ đến phát triển ý tưởng dự án của riêng mình.

Sự chuyển đổi từ học thụ động sang chủ động xây dựng là ý tưởng trung tâm của Sui Learning Tour. Corelia không chỉ tối ưu số lượng sinh viên tham dự workshop. Mục tiêu sâu hơn là **chuyển đổi người học thành builder**.

## 4. Demo

![14 đội sinh viên trình bày sản phẩm tại ITC Web3 Builders Demo Day](/blog/corelia-itc-demoday-2026/corelia-itc-demoday-2.png)

Một trong những minh chứng rõ nhất cho sự chuyển đổi đó là hành trình Kỹ sư Web3 – Sui Blockchain do Corelia triển khai tại ITC. Chương trình đi qua nhiều buổi thực hành về Sui Move, smart contract, token, giao diện dApp và tích hợp wallet.

Tại Web3 Builders Hackathon và Demo Day cuối chương trình, **14 đội trình bày những sản phẩm Web3 do chính mình xây dựng**. Kết quả đó thay đổi hoàn toàn điều sinh viên có thể nói sau hành trình: từ “Em đã tham dự một workshop blockchain” thành **“Đội của em đã xây dựng và trình diễn một sản phẩm trên Sui.”**

Sinh viên phải xác định vấn đề, ưu tiên tính năng, triển khai logic smart contract, kết nối giao diện sản phẩm, phối hợp theo nhóm, chuẩn bị live demo và phản hồi đánh giá.

Sáu đội có kết quả cao nhất sau đó được lựa chọn để tiến đến cuộc thi liên trường. Chương trình cũng mở ra những con đường tiềm năng đến internship và tiếp tục tham gia hệ sinh thái. Đó chính là khác biệt giữa nhận biết và kích hoạt.

## 5. Tiếp Tục

Một chương trình giáo dục thành công không nên kết thúc khi slide cuối cùng được trình bày. Sui Learning Tour được thiết kế để kết nối những sinh viên nổi bật với cơ hội tiếp theo: đào tạo nâng cao, cộng đồng developer, Mini Hackathon, cuộc thi lớn hơn, mentorship, internship và chương trình hệ sinh thái.

Điều này tạo ra một funnel nơi số lượng lớn sinh viên có thể khám phá hệ sinh thái, còn những người ngày càng cam kết sẽ tiến đến mức độ tham gia kỹ thuật sâu hơn. Không phải mọi người tham dự đều cần trở thành Sui developer, nhưng những sinh viên muốn xây dựng phải có bước đi tiếp theo rõ ràng.

## Mô Hình Kích Hoạt Đại Học

Sui Learning Tour giúp Corelia phát triển một framework có thể lặp lại cho hoạt động đào tạo hệ sinh thái:

### Nhận Biết

Giới thiệu công nghệ bằng ngôn ngữ và bối cảnh sinh viên có thể hiểu.

### Giáo Dục

Cung cấp nền tảng kỹ thuật có cấu trúc thay vì đưa người học trực tiếp vào kho tài liệu.

### Thực Hành

Tạo môi trường buộc sinh viên phải tự sử dụng công nghệ.

### Sản Phẩm

Kết nối việc học kỹ thuật với một thứ thực sự có thể trình diễn.

### Kiểm Chứng

Sử dụng Mini Hackathon và Demo Day để tạo deadline, phản hồi và bằng chứng năng lực.

### Tiếp Tục

Kết nối những builder mạnh nhất với cơ hội ngoài chương trình ban đầu tại trường.

Framework này được thiết kế theo mô-đun. Một trường đại học có thể bắt đầu bằng một workshop. Cohort mạnh hơn có thể tiếp tục với bootcamp. Builder có thể bước vào Mini Hackathon và những dự án tốt nhất có thể tiến xa hơn trong hệ sinh thái.

## Vai Trò Của Corelia

Corelia hoạt động xuyên suốt lớp giáo dục và kích hoạt tại địa phương:

**Kích hoạt Đại học · Giáo dục Bản địa hóa · Workshop Kỹ thuật · Đào tạo Developer · Thiết kế Trải nghiệm Học tập · Mentorship · Mini Hackathon · Demo Day · Cộng đồng Builder**

Công việc đòi hỏi nhiều hơn vận hành sự kiện. Corelia chuyển hóa khái niệm hệ sinh thái thành trải nghiệm học tập tại trường, làm việc với các trường đại học, thiết kế hành trình kỹ thuật, điều phối đơn vị đóng góp, hướng dẫn sinh viên trong quá trình xây dựng và tạo cơ hội để người học chứng minh tiến bộ.

## Vì Sao Case Study Này Quan Trọng

Sui Learning Tour trở thành một minh chứng quan trọng đối với Corelia vì cho thấy hoạt động kích hoạt hệ sinh thái tại đại học có thể vượt khỏi chỉ số độ phủ.

Một workshop có thể tạo nhận biết. Một bootcamp có thể phát triển kỹ năng. Một Mini Hackathon có thể tạo ra sản phẩm. Một Demo Day có thể cho thấy ai là builder. Một cộng đồng tiếp nối có thể giữ những builder đó kết nối sau khi chương trình ban đầu kết thúc.

Khi những mảnh ghép này được kết nối, hoạt động tiếp cận đại học trở nên giá trị hơn nhiều so với event marketing. Nó trở thành **hạ tầng pipeline developer**.

Bài học đó sau này trở thành nền tảng cho cách Corelia tiếp cận các chương trình giáo dục và hệ sinh thái quy mô lớn hơn.

**Khám phá → Học → Xây dựng → Demo → Tiếp tục**

### Corelia Academy

**Đưa hệ sinh thái công nghệ toàn cầu đến gần hơn với thế hệ builder tiếp theo.**
$md$),
('vi', 'sui-learning-tour-uef-2026', 'sui-learning-tour-uef-2026', 'blog', 'published', $md$Kick-off Web3 An Toàn tại UEF: Gần 100 Sinh Viên Khởi Động Hành Trình Bài Bản$md$, $md$Workshop #1 Kick-off tại UEF: Introduction to Blockchain & Sui thu hút gần 100 sinh viên, đặt nền móng tư duy Web3, lộ trình sự nghiệp và an toàn thông tin trước các Bootcamp và Hackathon.$md$, 'terran', 'career-ecosystem-insights', ARRAY['web3','blockchain-fundamentals','ecosystem','career-tips','move-language']::text[], '{"type":"image","src":"/blog/sui-uef.jpg","alt":"Sui Learning Tour x UEF 2026 - Kick-off Workshop tại Đại học Kinh tế - Tài chính TP.HCM","ogSrc":"/blog/og/sui-uef.jpg"}'::jsonb, '2026-01-01'::date, '2026-01-01'::timestamptz, '2026-01-01'::timestamptz, $md$Gần 100 sinh viên Đại học Kinh tế - Tài chính TP.HCM (UEF) đã có mặt tại Workshop #1 "Kick-off: Introduction to Blockchain & Sui": điểm dừng chân mới nhất của Sui Learning Tour trong năm 2026. Sui Foundation phối hợp cùng UEF và First Movers Vietnam không chỉ mở cánh cửa vào thế giới phi tập trung, mà còn đặt **an toàn thông tin và tài sản số** ngay từ bước đi đầu tiên.

## 1. Không Chỉ Là "Vào Cửa": Là Bước Đệm Đúng Hướng

![Sui Learning Tour x UEF 2026 - Kick-off workshop tại Đại học Kinh tế - Tài chính TP.HCM](/blog/sui-uef-1.jpg)

Workshop được thiết kế như trạm trung chuyển: đặt nền móng tư duy, định hình lộ trình và trang bị kiến thức bảo mật trước khi sinh viên bước vào các Bootcamp kỹ thuật và Hackathon. Mục tiêu là giúp người mới hiểu đúng, hiểu đủ: tránh "ngợp" giữa tốc độ thay đổi chóng mặt của Web3.

## 2. Nội Dung: Từ Nền Tảng Đến Cơ Hội Nghề Nghiệp

![Sui Learning Tour x UEF 2026 - Diễn giả và người tham gia tại Đại học Kinh tế - Tài chính](/blog/sui-uef-2.jpg)

Hai trụ cột chính của buổi Kick-off:

- **Blockchain Fundamentals & Sui Overview:** Các khái niệm cơ bản (Web2 vs Web3, Smart Contract, Wallet) được gỡ rối rõ ràng. Sức mạnh của Sui: kiến trúc hướng đối tượng (Object-centric) và ngôn ngữ Move: được giới thiệu như nền tảng để build an toàn và hiệu quả.

- **Web3 Career Path & Hackathon Opportunities:** Bức tranh thị trường việc làm Web3 và lộ trình thực tế *Sinh viên → Build Project → Hackathon → Job/Grant* giúp các bạn trẻ có định hướng cụ thể thay vì chỉ nghe lý thuyết.

## 3. Điểm Nhấn UEF: Web3 Security: Tư Duy Bảo Mật "Sống Còn"

![Sui Learning Tour x UEF 2026 - Người tham gia tại Đại học Kinh tế - Tài chính](/blog/sui-uef-3.jpg)

Điểm khác biệt của Kick-off tại UEF nằm ở học phần **An toàn thông tin & Tài sản số.** Trước khi trở thành builder, bạn cần là người dùng an toàn. Các chuyên gia đưa case study thực tế về Phishing, Scam, Smart Contract Exploit, trang bị nguyên tắc bảo vệ tài sản cá nhân và nhấn mạnh trách nhiệm bảo mật của developer khi xây dApp.

## 4. Kết Nối Với Các Chặng Tiếp Theo

Workshop #1 khép lại với tâm thế sẵn sàng: lộ trình tiếp theo cho sinh viên UEF đã được "mở khóa": **SUI x AI Bootcamp** và **Mini Hackathon – Demo Day** đang chờ phía trước. Cảm ơn UEF và toàn thể các bạn đã tạo nên không khí nhiệt huyết; hãy đăng ký các chương trình đào tạo chuyên sâu và bắt tay vào hành trình "Build thật, đi đường dài" cùng Sui.
$md$),
('vi', 'sui-learning-tour-utc2-2025', 'sui-learning-tour-utc2-2025', 'blog', 'published', $md$Tiếp Lửa Web3 Cho Hơn 200 Sinh Viên Kỹ Thuật: Sui Learning Tour x UTC2$md$, $md$Tổng kết workshop tại UTC2 (08/11/2025): từ Blockchain Dev Fundamentals, Hackathon Mastery đến Live Coding Move và Slush Wallet Challenge, cùng dàn diễn giả Sui Foundation và First Movers Vietnam.$md$, 'terran', 'career-ecosystem-insights', ARRAY['web3','blockchain-fundamentals','ecosystem','hackathon','move-language','career-tips']::text[], '{"type":"image","src":"/blog/sui-utc2.jpg","alt":"Sui Learning Tour x UTC2 2025 - Workshop tại Đại học Giao thông vận tải Phân hiệu TP.HCM","ogSrc":"/blog/og/sui-utc2.jpg"}'::jsonb, '2025-11-08'::date, '2025-11-08'::timestamptz, '2025-11-08'::timestamptz, $md$Sáng 08/11/2025, hơn 200 sinh viên và lập trình viên trẻ đổ về Trường Đại học Giao thông vận tải Phân hiệu TP.HCM (UTC2), Thủ Đức, cho chặng Sui Learning Tour tại đây. Sui Community và First Movers Vietnam đã dành trọn 4 giờ để vừa gỡ rào cản khái niệm vừa đưa mọi người tiếp cận trực tiếp hệ sinh thái Sui: blockchain hiệu năng cao, bảo mật và thân thiện với developer.

## 1. Blockchain Trên Giảng Đường: Không Chỉ Là Xu Hướng

![Sui Learning Tour x UTC2 2025 - Khai mạc workshop tại Đại học Giao thông vận tải Phân hiệu TP.HCM](/blog/sui-utc2-1.jpg)

Mục tiêu là lan tỏa kiến thức và thực hành Web3 đến sinh viên toàn quốc. Tại UTC2, Blockchain được trình bày như nền tảng công nghệ đang định hình tương lai: không dừng ở khái niệm mà đi thẳng vào trải nghiệm.

## 2. Hành Trang Chuyên Sâu Từ Dàn Diễn Giả Giàu Kinh Nghiệm

![Các diễn giả chia sẻ tại Sui Learning Tour x UTC2 2025](/blog/sui-utc2-2.jpg)

Điểm nhấn thu hút nhất của workshop chính là những phiên chia sẻ "thực chiến" từ các chuyên gia hàng đầu, bao gồm:

- **Anh Thái Phạm Ngọc Tường**: Developer Ambassador, Sui Foundation & Founder, Purro Wallet
- **Anh Victor Lương**: Host/Content Creator, ETH34 & DeFi.vn
- **Anh Phan Hoàng Vinh Hiển**: Developer Relations, First Movers Vietnam
- **Anh Nguyễn Hà Phúc**: Developer Ambassador, Sui Foundation

Các diễn giả đã dẫn dắt người tham gia đi từ Blockchain Dev Fundamentals (tư duy lập trình on-chain/off-chain, tổng quan ngôn ngữ Move) đến việc phân tích sâu sắc các Cơ hội nghề nghiệp (Career & Market Opportunities) trong bối cảnh thị trường trong và ngoài nước. Đặc biệt, nội dung Hackathon Mastery đã trang bị cho các bạn trẻ tư duy xây dựng ý tưởng, làm việc nhóm và kỹ năng "pitching" hiệu quả từ những đội thi top-tier.

## 3. Trải Nghiệm Thực Tế: Từ "Live Coding" Đến "Slush Wallet Challenge"

![Sinh viên UTC2 thực hành tại workshop Sui Learning Tour](/blog/sui-utc2-3.jpg)

Bầu không khí tại hội trường UTC2 luôn được duy trì ở mức nhiệt cao nhất nhờ các hoạt động tương tác liên tục:

- **Live Coding Session:** Sinh viên không chỉ nghe lý thuyết mà còn được tận mắt xem hướng dẫn xây dựng, triển khai và kiểm thử một smart contract cơ bản bằng ngôn ngữ Move trên mạng thử nghiệm Sui.
- **Mini-game on-chain:** Trải nghiệm thực tế ví Slush trên Sui thông qua thử thách "Slush Wallet Challenge" đã mang đến cơ hội nhận phần thưởng token SUI và nhiều phần quà hấp dẫn từ ban tổ chức.

Các bạn sinh viên tham gia trọn vẹn chương trình đều nhận được Chứng nhận hoàn thành workshop, mở ra cơ hội tham gia các nhóm học tập chuyên sâu, dự án và Hackathon lớn trong tương lai.

## 4. Kết

Workshop tại UTC2 là minh chứng cho nỗ lực đưa giáo dục Web3 và tài nguyên lập trình chất lượng đến gần sinh viên: sứ mệnh cốt lõi của các dự án như Corelia Academy. Hơn 200 bạn trẻ tại đây tạo đà để Sui Learning Tour tiếp tục đến Văn Lang và Văn Hiến trong tháng 12. Cảm ơn UTC2, First Movers Vietnam và toàn thể sinh viên đã cùng nhau học hỏi và xây dựng tương lai Web3 tại Việt Nam.
$md$),
('vi', 'sui-learning-tour-van-hien-university-2025', 'sui-learning-tour-van-hien-university-2025', 'blog', 'published', $md$Build on Sui tại Văn Hiến: Nền Móng Kỹ Thuật Trước Mini Hackathon$md$, $md$Tổng kết Technical Workshop (Buổi 1) tại Đại học Văn Hiến (16/12/2025): Build on Sui Blockchain – từ Blockchain Dev Fundamentals, Career & Hackathon Mastery đến Live Coding Move, cùng dàn diễn giả Sui Foundation, OLYM3 và First Movers Vietnam.$md$, 'terran', 'career-ecosystem-insights', ARRAY['web3','blockchain-fundamentals','ecosystem','hackathon','move-language','career-tips']::text[], '{"type":"image","src":"/blog/sui-vanhien.jpg","alt":"Sui Learning Tour x Van Hien University 2025 - Technical Workshop Build on Sui tại Hùng Hậu Campus","ogSrc":"/blog/og/sui-vanhien.jpg"}'::jsonb, '2025-12-16'::date, '2025-12-16'::timestamptz, '2025-12-16'::timestamptz, $md$Sáng 16/12/2025, hơn 180 sinh viên CNTT Đại học Văn Hiến (Hùng Hậu Campus) tham gia buổi Technical Workshop đầu tiên với chủ đề "Build on Sui Blockchain". Đây là bước chạy đà cho hai tuần thực hành dự án online và Mini Hackathon sắp tới: Sui Community đặt trọng tâm vào thực hành kỹ thuật, không dừng ở xu hướng.

## 1. Hành Trang Bắt Buộc Để Trở Thành Blockchain Developer

![Sui Learning Tour x Van Hien University 2025 - Khai mạc Technical Workshop tại Hùng Hậu Campus](/blog/sui-vanhien-1.jpg)

Buổi Kick-off mang tính bản lề: trang bị nền tảng kiến thức vững về Blockchain và Sui trước khi sinh viên Văn Hiến bước vào 2 tuần thực hành online và Mini Hackathon cường độ cao. Đây là "điều kiện cần" để build đúng hướng.

## 2. Hành Trình Khám Phá: Từ Tư Duy Đến Lộ Trình Nghề Nghiệp

![Các diễn giả tại Sui Learning Tour x Van Hien University 2025](/blog/sui-vanhien-2.jpg)

Trong suốt 4 giờ đồng hồ, các bạn sinh viên đã được dẫn dắt qua những nội dung cốt lõi nhất dưới sự chia sẻ của các chuyên gia hàng đầu:

- **Blockchain Dev Fundamentals:** Anh Thái Phạm Ngọc Tường (Developer Mentor, Sui Foundation) đã giúp sinh viên hệ thống hóa tư duy lập trình on-chain/off-chain và phô diễn sức mạnh của ngôn ngữ Move.
- **Career & Market Opportunities:** Với góc nhìn từ một quỹ đầu tư quốc tế, thầy Nhã (Giám đốc công ty OLYM3) đã phác họa bức tranh toàn cảnh về thị trường Web3, giúp sinh viên hiểu rõ "khẩu vị" của các nhà tuyển dụng và nhà đầu tư hiện nay.
- **Hackathon Mastery:** Dưới sự chia sẻ của anh Phan Hoàng Vinh Hiển (Developer Relations, First Movers VN), các "bí kíp" từ việc lên ý tưởng, xây dựng bản Demo đến kỹ năng Pitching thuyết phục đã được truyền đạt trọn vẹn.

## 3. Điểm Nhấn Thực Chiến: Build Your First Move Contract

![Sinh viên Văn Hiến thực hành Live Coding – viết và deploy Smart Contract đầu tiên](/blog/sui-vanhien-3.jpg)

Không khí tại Hùng Hậu Campus thực sự bùng nổ trong phiên Live Coding Workshop. Dưới sự hướng dẫn tận tình của hai Developer Ambassador là Anh Trần Tấn Phát và Anh Nguyễn Hà Phúc, các bạn sinh viên mang theo laptop đã được trực tiếp cầm tay chỉ việc:

- **Thiết lập** môi trường lập trình với Sui CLI.
- **Tự tay** viết, biên dịch và triển khai (Deploy) thành công Smart Contract đầu tiên của mình ngay tại lớp học.

Xen kẽ với những giờ phút tập trung cao độ là hoạt động Mini-game Quiz vô cùng sôi động. Sự tương tác nhanh nhạy của các bạn sinh viên không chỉ khuấy động hội trường mà còn mang về những phần quà công nghệ hấp dẫn.

## 4. Kết: Sẵn Sàng Cho Thử Thách Mới

Workshop khép lại bằng phiên Q&A chuyên sâu: sinh viên và diễn giả cùng "debug" lỗi kỹ thuật và thảo luận ý tưởng dự án. Nhiệm vụ truyền lửa và trang bị vũ khí kỹ thuật cho builder tương lai đã hoàn thành. Sinh viên Văn Hiến chính thức bước vào Giai đoạn 2: hai tuần thực hành dự án online. Hãy áp dụng kiến thức vừa học, giữ tinh thần đồng đội và chuẩn bị bứt phá tại Mini Hackathon. Cảm ơn Đại học Văn Hiến và toàn thể các bạn đã tạo nên buổi sáng đầy nhiệt huyết: cùng nhau từng bước xây dựng tương lai Web3 tại Việt Nam.
$md$),
('vi', 'sui-learning-tour-van-lang-university-2025', 'sui-learning-tour-van-lang-university-2025', 'blog', 'published', $md$Web3 Gaming & Blockchain tại Văn Lang: Gần 140 Sinh Viên Cùng Sui$md$, $md$Tổng kết workshop tại VLU (06/11/2025): Blockchain Technology & Web3 Gaming, từ Blockchain Dev Fundamentals, On-chain Game Design đến Live Coding Move và Slush Wallet Challenge, cùng dàn diễn giả Sui Foundation, NamLongDAO và First Movers Vietnam.$md$, 'terran', 'career-ecosystem-insights', ARRAY['web3','blockchain-fundamentals','ecosystem','hackathon','move-language','career-tips']::text[], '{"type":"image","src":"/blog/sui-vanlang.jpg","alt":"Sui Learning Tour x Van Lang University 2025 - Workshop Blockchain Technology & Web3 Gaming","ogSrc":"/blog/og/sui-vanlang.jpg"}'::jsonb, '2025-12-06'::date, '2025-12-06'::timestamptz, '2025-12-06'::timestamptz, $md$Chủ đề "Blockchain Technology & Web3 Gaming - Cơ hội Nghề nghiệp" đã kéo gần 140 sinh viên Đại học Văn Lang (Cơ sở Chính) đến Phòng F.08.04 sáng 06/12/2025. Sui Community tổ chức riêng cho VLU một góc nhìn mới: blockchain đang định hình lại ngành game và ứng dụng phi tập trung như thế nào.

## 1. Giảng Đường Làm "Cái Nôi" Cho Builder Tương Lai

![Sui Learning Tour x Van Lang University 2025 - Khai mạc workshop tại Phòng F.08.04](/blog/sui-vanlang-1.jpg)

Sự kiện kết hợp nền tảng kỹ thuật cốt lõi và xu hướng Web3 Gaming. Sinh viên được khám phá Sui: blockchain tốc độ cao, chi phí thấp, phù hợp để xây các tựa game on-chain phức tạp: qua góc nhìn thực tế của thị trường.

## 2. Dấu Ấn Từ Dàn Diễn Giả Chuyên Gia

![Các diễn giả tại Sui Learning Tour x Van Lang University 2025](/blog/sui-vanlang-2.jpg)

Xuyên suốt 4 giờ đồng hồ, bầu không khí tại Phòng F.08.04 luôn được giữ nhiệt nhờ những chia sẻ sâu sắc và thực tế từ đội ngũ diễn giả, bao gồm:

- **Anh Thái Phạm Ngọc Tường**: Developer Mentor tại Sui Foundation; Founder Purro Wallet & Corelia Academy
- **Anh Hải Long**: Founder NamLongDAO
- **Anh Phan Hoàng Vinh Hiển**: Developer Relations tại First Movers Vietnam
- **Anh Trần Tấn Phát & Anh Nguyễn Hà Phúc**: Developer Mentor tại Sui Foundation

Các chuyên gia đã dẫn dắt sinh viên đi từ Blockchain Dev Fundamentals (kiến trúc dữ liệu phi tập trung, mô hình đối tượng của Sui, ngôn ngữ Move) đến On-chain Game Design (Tài sản sở hữu thật - digital ownership, cơ chế game logic on-chain). Đồng thời, phần chia sẻ về Hackathon Mastery cũng mang lại những "bí kíp" quý giá giúp các bạn sinh viên tự tin lên ý tưởng và thiết kế sản phẩm trong các cuộc thi công nghệ.

## 3. Học - Chơi - Thực Hành: Tương Tác On-chain Cực "Cuốn"

![Sinh viên VLU thực hành Live Coding và Slush Wallet Challenge tại workshop](/blog/sui-vanlang-3.jpg)

Điểm nhấn khác biệt làm nên sức hút của workshop chính là chuỗi hoạt động tương tác liên tục:

- **Live Coding Session:** Sinh viên VLU được tận mắt chứng kiến quy trình viết, triển khai và kiểm thử một smart contract (hợp đồng thông minh) bằng ngôn ngữ Move trên mạng Sui Devnet/Testnet.
- **Mini-game "Slush Wallet Challenge":** Cả hội trường hào hứng tham gia trải nghiệm thử thách on-chain qua ví Slush. Việc tự tay tương tác với contract và nhận phần thưởng thực tế bằng token SUI đã giúp các bạn hiểu rõ hơn về trải nghiệm người dùng trong môi trường Web3.

Đặc biệt, những sinh viên tham gia đầy đủ chương trình đều được cấp Chứng nhận hoàn thành workshop, một điểm nhấn tuyệt vời cho CV trong mắt các nhà tuyển dụng công nghệ.

## 4. Kết

Workshop Sui Learning Tour x Van Lang 2025 kết thúc với ấn tượng mạnh và ngọn lửa đam mê công nghệ trong cộng đồng VLU. Đây là bước chạy đà để các bạn trẻ nắm bắt cơ hội nghề nghiệp và trở thành builder tiên phong trong Blockchain & Web3 Gaming tại Việt Nam. Cảm ơn Đại học Văn Lang và toàn thể sinh viên; tiếp tục rèn Move và theo dõi Sui Community để săn cơ hội Hackathon sắp tới.
$md$),
('vi', 'sui-learning-tour-webdev-studios', 'sui-learning-tour-webdev-studios', 'blog', 'published', $md$Nhìn Lại Sự Kiện "Sui Learning Tour x WebDev Studios": Hành Trình Khám Phá Công Nghệ Blockchain Cùng Sinh Viên IT$md$, $md$Tổng kết workshop Blockchain Technology tại UIT (17/09/2025): từ khái niệm đến công cụ thực tiễn, chia sẻ từ chuyên gia Sui và cơ hội kết nối cho sinh viên.$md$, 'terran', 'career-ecosystem-insights', ARRAY['web3','blockchain-fundamentals','ecosystem','hackathon']::text[], '{"type":"image","src":"/blog/sui-learning-tour-webdev.jpg","alt":"Sui Learning Tour x WebDev Studios - Blockchain Technology Workshop","ogSrc":"/blog/og/sui-learning-tour-webdev.jpg"}'::jsonb, '2025-09-17'::date, '2025-09-17'::timestamptz, '2025-09-17'::timestamptz, $md$Vào ngày 17/09/2025 vừa qua, sự kiện "Sui Learning Tour x WebDev Studios: Blockchain Technology Workshop" đã diễn ra thành công tốt đẹp tại Trường Đại học Công nghệ Thông tin, ĐHQG-HCM (UIT). Mang theo sứ mệnh giải mã những tiềm năng của Web3 và Blockchain, sự kiện đã thu hút đông đảo các bạn sinh viên đam mê công nghệ tại khu vực TP.HCM tham dự.

## 1. Đưa Blockchain từ "Từ khóa Hot" đến Công cụ Thực tiễn

![Sui Learning Tour x WebDev Studios - Blockchain Technology Workshop](/blog/NVA05575.JPG)

Chúng ta đang sống trong một kỷ nguyên số, nơi blockchain đang dần tái định hình lại thế giới: từ tài chính phi tập trung (DeFi), NFT, Metaverse cho đến vô số những ứng dụng Web3 khác với sự minh bạch và bảo mật cao.

Hiểu được tầm quan trọng đó, Sui Community đã phối hợp cùng WebDev Studios tổ chức buổi workshop nhằm mang đến những kiến thức nền tảng và góc nhìn thực tiễn nhất. Tại đây, Blockchain không còn là một khái niệm xa vời mà đã được phân tích như một công cụ thiết thực, mở ra những cơ hội sáng tạo chưa từng có cho giới trẻ.

## 2. Những Điểm Nhấn Đáng Chú Ý Tại Workshop

![Sui Learning Tour x WebDev Studios - Blockchain Technology Workshop](/blog/NVA05646.JPG)

Sự kiện diễn ra từ 13:00 đến 16:30 tại Hội trường E, UIT trong không khí vô cùng năng động. Những dấu ấn nổi bật có thể kể đến như:

**Lắng nghe chia sẻ từ Chuyên gia:** Buổi workshop hân hạnh có sự góp mặt của diễn giả Anh Thái Phạm Ngọc Tường – Developer Ambassador tại SuiHub Ho Chi Minh City. Bằng những kinh nghiệm thực chiến của mình, anh đã mang đến một bức tranh toàn cảnh về xu hướng công nghệ hiện tại và cách ứng dụng hệ sinh thái Sui.

**Tương tác & Mở rộng Network:** Không chỉ có lý thuyết một chiều, các bạn sinh viên đến từ nhiều trường Đại học đã tích cực tham gia đặt câu hỏi, thảo luận sôi nổi cùng diễn giả. Đây cũng là "cơ hội vàng" để các bạn giao lưu và kết nối với những người bạn chung niềm đam mê công nghệ.

**Quyền lợi hấp dẫn:** Sự kiện mở cửa hoàn toàn miễn phí. Hơn thế nữa, các bạn sinh viên tham dự còn nhận được những phần quà thú vị từ ban tổ chức trong suốt thời gian diễn ra chương trình, cũng như được cộng điểm rèn luyện đối với sinh viên UIT.

## 3. Lời Kết

![Sui Learning Tour x WebDev Studios - Blockchain Technology Workshop](/blog/NVA05743.JPG)

Sui Learning Tour x WebDev Studios: Blockchain Technology Workshop đã khép lại thành công rực rỡ, hoàn thành xuất sắc mục tiêu đồng hành cùng sinh viên Việt Nam trên con đường chinh phục không gian Web3. Thông qua sự kiện, các bạn trẻ không chỉ tích lũy thêm kiến thức mà còn được truyền nguồn cảm hứng lớn lao để tự tin phát triển bản thân.

Xin cảm ơn tất cả các bạn sinh viên đã đến tham dự và tạo nên một bầu không khí bùng nổ. Hãy tiếp tục theo dõi và đồng hành cùng Sui Community để không bỏ lỡ những sự kiện và dự án công nghệ hấp dẫn tiếp theo!
$md$),
('vi', 'trao-giai-hackathon-web3-builders-tai-itc-2026', 'trao-giai-hackathon-web3-builders-tai-itc-2026', 'blog', 'published', $md$Trao Giải Hackathon Web3 Builders Tại ITC: Vinh Danh Những Dự Án Web3 Xuất Sắc$md$, $md$Lễ trao giải Hackathon Web3 Builders ngày 15/05/2026 vinh danh những dự án nổi bật của sinh viên ITC sau hành trình học tập, xây dựng và trình diễn sản phẩm trên Sui Blockchain.$md$, 'corelia-team', 'career-ecosystem-insights', ARRAY['web3','move-language','dapp-development','project-based','hackathon','ecosystem']::text[], '{"type":"image","src":"/blog/corelia-itc-award-2026/corelia-itc-award.jpg","alt":"Lễ trao giải Hackathon Web3 Builders tại ITC","fit":"cover"}'::jsonb, '2026-05-15'::date, '2026-05-15'::timestamptz, '2026-05-15'::timestamptz, $md$Ngày **15/05/2026**, chương trình **“Kỹ sư Web3 – Sui Blockchain”** tại ITC đã đi đến một cột mốc đáng nhớ với lễ tổng kết và trao giải cuộc thi **Hackathon “Web3 Builders”**. Đây là dịp vinh danh những đội thi nổi bật sau hành trình học tập, phát triển và trực tiếp trình diễn các sản phẩm Web3 trước Hội đồng đánh giá.

Trước lễ trao giải, [14 đội thi đã cùng bước lên sân khấu Demo Day](/vi/blog/khep-lai-hanh-trinh-ky-su-web3-sui-blockchain-demo-day-2026), giới thiệu những dự án được xây dựng từ kiến thức và kỹ năng tích lũy trong suốt chương trình. Từ những buổi đầu làm quen với Sui Move, Smart Contract, Token và dApp, sinh viên đã từng bước chuyển kiến thức thành sản phẩm có thể trình bày và kiểm chứng.

Bạn cũng có thể xem lại [hành trình đào tạo Kỹ sư Web3 tại ITC](/vi/blog/corelia-trien-khai-chuong-trinh-dao-tao-ky-su-web3-tai-itc-2026) để nhìn lại cách các builder trẻ chuẩn bị cho Hackathon “Web3 Builders”.

## 1. Từ 14 Phần Demo Đến Những Dự Án Được Vinh Danh

![Toàn cảnh lễ trao giải Hackathon Web3 Builders tại ITC](/blog/corelia-itc-award-2026/corelia-itc-award-1.jpg)

Tại buổi bảo vệ và báo cáo đồ án trước đó, **14 đội thi** đã trực tiếp demo sản phẩm và trình bày dự án Web3 trước Hội đồng đánh giá. Mỗi đội mang đến một cách tiếp cận riêng, cho thấy khả năng vận dụng công nghệ, phối hợp nhóm và hoàn thiện sản phẩm trong khuôn khổ một chương trình đào tạo thực hành.

Để đi đến sân khấu Demo Day, sinh viên không chỉ cần viết code. Các đội còn phải xác định vấn đề muốn giải quyết, thống nhất ý tưởng, phân chia vai trò, kết nối Smart Contract với giao diện và chuẩn bị cách truyền đạt giá trị của sản phẩm. Đó là một quá trình đòi hỏi sự kiên trì, khả năng thích nghi và tinh thần chịu trách nhiệm với phần việc của mình.

Các sản phẩm được Hội đồng đánh giá cao ở ba dấu ấn nổi bật:

- **Tính sáng tạo:** Thể hiện qua cách các đội hình thành ý tưởng và tiếp cận bài toán bằng công nghệ Web3.
- **Khả năng ứng dụng thực tiễn:** Cho thấy nỗ lực đưa công nghệ vào những bối cảnh và nhu cầu cụ thể.
- **Tinh thần thực chiến:** Được thể hiện trong toàn bộ quá trình xây dựng, phối hợp, xử lý vấn đề và demo sản phẩm.

Lễ trao giải vì vậy không chỉ ghi nhận kết quả cuối cùng. Đây còn là sự ghi nhận dành cho quá trình học hỏi và trưởng thành của sinh viên từ những dòng code đầu tiên đến khi có thể đứng trước Hội đồng để bảo vệ sản phẩm của đội mình.

## 2. Kết Quả Hackathon “Web3 Builders”

Sau quá trình đánh giá, Ban Giám khảo đã lựa chọn những đội thi xuất sắc nhất của Hackathon “Web3 Builders”. Mỗi giải thưởng là một dấu mốc cho nỗ lực biến kiến thức thành sản phẩm và tinh thần sẵn sàng thử sức với một lĩnh vực công nghệ mới.

### Top 1: Sui Nexus Artillery – Lớp CD25CT-CLC

![Trao giải Top 1 cho Sui Nexus Artillery](/blog/corelia-itc-award-2026/corelia-itc-award-2.jpg)

Vị trí cao nhất của Hackathon “Web3 Builders” thuộc về **Sui Nexus Artillery** đến từ lớp **CD25CT-CLC**. Thành tích Top 1 ghi nhận phần thể hiện nổi bật của đội trong quá trình xây dựng và báo cáo đồ án.

### Top 2: Saigon Coffee Collective – Lớp CD25CT5

![Trao giải Top 2 cho Saigon Coffee Collective](/blog/corelia-itc-award-2026/corelia-itc-award-3.jpg)

Giải Top 2 được trao cho **Saigon Coffee Collective** đến từ lớp **CD25CT5**. Đây là kết quả xứng đáng cho hành trình làm việc nhóm, hoàn thiện sản phẩm và trình bày dự án tại Demo Day.

### Top 3: Fantastic Farm – Lớp CD25LM2

![Trao giải Top 3 cho Fantastic Farm](/blog/corelia-itc-award-2026/corelia-itc-award-4.jpg)

Vị trí Top 3 gọi tên **Fantastic Farm** đến từ lớp **CD25LM2**. Đội đã hoàn thành hành trình Hackathon và để lại dấu ấn trong phần đánh giá đồ án.

### Giải Khuyến Khích

Hai Giải Khuyến khích được trao cho:

- **Sui Ticket** – Lớp **CD25CT6**

![Trao Giải Khuyến khích cho Sui Ticket](/blog/corelia-itc-award-2026/corelia-itc-award-5.jpg)


- **CV On-chain** – Lớp **CD25CT-CLC**

![Trao Giải Khuyến khích cho CV On-chain](/blog/corelia-itc-award-2026/corelia-itc-award-6.jpg)

Các giải thưởng ghi nhận nỗ lực của hai đội trong quá trình phát triển ý tưởng, xây dựng sản phẩm và hoàn thành phần demo trước Hội đồng.

## 3. Community Choice Gọi Tên Assets Auction

![Trao giải Community Choice cho Assets Auction](/blog/corelia-itc-award-2026/corelia-itc-award-7.jpg)

Bên cạnh các hạng mục do Ban Giám khảo đánh giá, **Assets Auction** được vinh danh ở hạng mục **Community Choice**. Giải thưởng này mang một ý nghĩa riêng khi thể hiện sự chú ý và kết nối mà dự án tạo ra với cộng đồng theo dõi chương trình.

Trong một hành trình phát triển sản phẩm, phản hồi từ cộng đồng là nguồn thông tin quan trọng. Nó giúp builder hiểu cách ý tưởng được đón nhận, nội dung nào tạo được sự quan tâm và sản phẩm cần tiếp tục cải thiện ở đâu. Community Choice vì thế không chỉ là một danh hiệu, mà còn là động lực để đội thi tiếp tục lắng nghe người dùng và phát triển dự án sau Hackathon.

## 4. Giải Thưởng Là Cột Mốc, Không Phải Điểm Kết Thúc

Hackathon thường được nhớ đến qua thứ hạng và giải thưởng, nhưng giá trị bền vững hơn nằm trong chính quá trình xây dựng. Sinh viên đã trải nghiệm việc biến một ý tưởng thành phạm vi sản phẩm, kết nối các thành phần kỹ thuật, làm việc trong giới hạn thời gian và thuyết phục người khác bằng một phần demo cụ thể.

Qua hành trình này, mỗi đội đều tạo ra một kết quả có thể tiếp tục phát triển. Sản phẩm tại Demo Day có thể trở thành một phần trong portfolio, một ví dụ về kinh nghiệm làm việc nhóm hoặc điểm khởi đầu cho những thử nghiệm tiếp theo với Sui Blockchain.

Ngay cả khi không nằm trong danh sách nhận giải, việc hoàn thành một dự án và bảo vệ sản phẩm trước Hội đồng vẫn là một dấu mốc đáng ghi nhận. Mỗi lần gặp lỗi, thay đổi phạm vi, nhận phản hồi và cải tiến đều góp phần hình thành tư duy của một builder thực thụ.

## 5. Thực Hành – Thực Chiến – Gắn Doanh Nghiệp

Chương trình do **Corelia triển khai tại ITC**, với sự phối hợp của nhà trường và sự đồng hành chuyên môn từ **Sui, CommandOSS cùng các chuyên gia trong lĩnh vực Blockchain**. Xuyên suốt hành trình, định hướng **“Thực hành – Thực chiến – Gắn doanh nghiệp”** được thể hiện qua cách sinh viên học kiến thức mới, trực tiếp xây dựng sản phẩm và trình bày kết quả trong môi trường có sự tham gia của chuyên gia.

Mô hình này giúp thu hẹp khoảng cách giữa lớp học và thực tế nghề nghiệp. Sinh viên không chỉ tiếp cận Web3 như một chủ đề công nghệ, mà còn học cách làm việc theo nhóm, quản lý tiến độ, giải quyết vấn đề và giao tiếp về sản phẩm: những năng lực cần thiết trong môi trường doanh nghiệp.

Sự kết nối giữa nhà trường, đơn vị triển khai và hệ sinh thái cũng mở ra thêm góc nhìn cho sinh viên về những con đường có thể theo đuổi. Từ một đồ án trong chương trình, các bạn có thể tiếp tục hoàn thiện portfolio, tham gia những sân chơi công nghệ lớn hơn và chủ động tìm kiếm cơ hội phát triển trong Web3.

## 6. Một Hành Trình Khép Lại, Những Web3 Builders Tiếp Tục Bước Đi

Lễ trao giải ngày 15/05/2026 đã khép lại một hành trình nhiều thử thách nhưng cũng đầy dấu ấn. Từ lớp học đến Hackathon, từ những bài thực hành đầu tiên đến sân khấu Demo Day, sinh viên ITC đã chứng minh rằng kiến thức chỉ thực sự tạo ra giá trị khi được biến thành hành động và sản phẩm cụ thể.

Xin chúc mừng:

- **Top 1:** Sui Nexus Artillery – Lớp CD25CT-CLC
- **Top 2:** Saigon Coffee Collective – Lớp CD25CT5
- **Top 3:** Fantastic Farm – Lớp CD25LM2
- **Giải Khuyến khích:** Sui Ticket – Lớp CD25CT6
- **Giải Khuyến khích:** CV On-chain – Lớp CD25CT-CLC
- **Community Choice:** Assets Auction

Đồng thời, xin chúc mừng cả 14 đội thi đã hoàn thành Hackathon “Web3 Builders”. Những sản phẩm, kinh nghiệm và kết nối được tạo ra trong chương trình sẽ là hành trang để các bạn tiếp tục học hỏi, thử nghiệm và từng bước trở thành những Web3 Builders trong tương lai.
$md$),
('vi', 'unihackfest-2026-la-gi-kick-off-tai-uef', 'unihackfest-2026-la-gi-kick-off-tai-uef', 'blog', 'published', $md$UniHackFest 2026 Là Gì? Hành Trình 14 Tuần Chính Thức Kick-off Tại UEF$md$, $md$UniHackFest 2026 là chương trình học và thi dành cho sinh viên, giúp các đội đi từ market insight đến sản phẩm AI & Web3 thực tế trong 14 tuần, chính thức Kick-off tại UEF ngày 15/06/2026.$md$, 'corelia-team', 'announcements-events', ARRAY['web3','blockchain-fundamentals','dapp-development','ecosystem','project-based','hackathon']::text[], '{"type":"image","src":"/blog/unihackfest-2026-la-gi-kick-off-tai-uef/unihackfest-la-gi.jpg","alt":"UniHackFest 2026 Kick-off tại UEF","fit":"cover"}'::jsonb, '2026-06-14'::date, '2026-06-14'::timestamptz, '2026-06-14'::timestamptz, $md$**UniHackFest 2026** là chương trình học và thi dành cho sinh viên đại học tại Việt Nam, được thiết kế để đưa các đội đi từ một vấn đề thực tế đến sản phẩm AI & Web3 có thể demo và pitching trong 14 tuần.

Chương trình sẽ chính thức **Kick-off vào ngày 15/06/2026 tại Đại học Kinh tế – Tài chính TP.HCM (UEF)**. Đây đồng thời là điểm mở màn của UniHackFest UniTour 2026: chuỗi workshop dự kiến đi qua 15 trường đại học trên toàn quốc trong hai tháng.

UniHackFest được đồng tổ chức bởi **Corelia Academy và UEF**, với sự tài trợ của **MEXC Ventures và Solana**. Thay vì bắt đầu bằng áp lực thi đấu, chương trình theo đuổi mô hình **“học trước – thi sau”**, giúp sinh viên có nền tảng về thị trường, sản phẩm và công nghệ trước khi bước vào Qualification Round và Demo Day.

> **Cập nhật:** Kick-off đã diễn ra vào ngày 15/06/2026. Xem bài [Corelia cùng UEF khởi động UniHackFest UniTour 2026](/vi/blog/corelia-uef-khoi-dong-unihackfest-unitour-2026) để đọc recap chương trình.

## Từ Giảng Đường Đến Sản Phẩm AI & Web3 Thực Tế

Sinh viên thường có nhiều cơ hội tiếp cận kiến thức công nghệ qua môn học, workshop và tài liệu trực tuyến. Tuy nhiên, khoảng cách từ “đã học” đến “có thể xây dựng sản phẩm” vẫn còn rất lớn.

UniHackFest được tạo ra để thu hẹp khoảng cách đó. Trong 14 tuần, sinh viên không chỉ nghe về AI, Blockchain hay Web3 mà trực tiếp nghiên cứu vấn đề, hình thành ý tưởng, phát triển MVP, xây dựng sản phẩm on-chain và trình bày kết quả.

Mỗi giai đoạn đều hướng đến một đầu ra cụ thể. Điều này giúp người học nhìn thấy tiến trình của mình, còn mentor và Ban Tổ chức có thể đưa ra phản hồi dựa trên những gì đội đã thực sự tạo ra.

Hành trình không chỉ dành cho Developer. Một đội UniHackFest có thể kết hợp nhiều vai trò:

- **Developer** xây dựng chương trình, giao diện và các luồng tương tác kỹ thuật.
- **Designer** thiết kế trải nghiệm và giúp sản phẩm trở nên dễ hiểu, dễ sử dụng.
- **Product/Business** nghiên cứu vấn đề, thị trường, người dùng và xây dựng câu chuyện pitching.

Sự kết hợp giữa các vai trò giúp sinh viên hiểu rằng một sản phẩm công nghệ tốt không chỉ cần code chạy được, mà còn phải giải quyết vấn đề rõ ràng và truyền đạt được giá trị đến người dùng.

## Mô Hình “Học Trước – Thi Sau”

Khác với một Hackathon ngắn hạn, UniHackFest xây dựng nền tảng cho sinh viên trước khi bước vào vòng thi. Chương trình gồm năm nội dung thực chiến:

### C1 – Market Insight

Sinh viên học cách quan sát thị trường, xác định vấn đề, người dùng và quy mô cơ hội. Đầu ra của giai đoạn này là **Market Memo**: tài liệu giúp đội chứng minh sản phẩm được xây dựng dựa trên insight thay vì phỏng đoán.

### C2 – AI Product Building

Từ insight đã có, các đội chuyển ý tưởng thành **AI Product MVP**. Sinh viên học cách chọn tính năng cốt lõi, xác định giả định cần kiểm chứng và sử dụng AI như một phần có chủ đích của sản phẩm.

### C3 – Rust Survival Kit

Người học tiếp cận những nền tảng Rust cần thiết thông qua **Rust On-chain Lab**. Mục tiêu không phải học toàn bộ ngôn ngữ trong thời gian ngắn, mà nắm được công cụ và tư duy cần thiết để bước vào phát triển on-chain.

### C4 – Solana Bootcamp

Các đội phát triển **dApp trên Solana Devnet**, kết nối ví, xây dựng giao diện và tạo ra những giao dịch có thể kiểm chứng trên Explorer.

### C5 – Pitching

Ở giai đoạn cuối, sinh viên hoàn thiện **Pitch Deck và Demo**, làm rõ vấn đề, giải pháp, sản phẩm, thị trường và kế hoạch phát triển tiếp theo.

Năm đầu ra liên kết với nhau thành một quy trình hoàn chỉnh: **Market Memo → AI Product MVP → Rust On-chain Lab → Solana dApp Devnet → Pitch Deck và Demo**.

## Hai Competition Track

UniHackFest 2026 có hai hướng thi đấu, phản ánh hai lớp năng lực quan trọng khi xây dựng sản phẩm công nghệ.

### Product & Business Track – MEXC Ventures

Track tập trung vào sản phẩm và thị trường tài sản số. Các đội đào sâu vào nghiên cứu thị trường, market sizing và chiến lược tiếp cận người dùng phù hợp với Việt Nam hoặc Đông Nam Á.

Đây là lựa chọn phù hợp với những đội muốn chứng minh khả năng phát hiện cơ hội, hiểu người dùng và xây dựng một hướng đi thực tế cho sản phẩm.

### Technical Build Track – Solana

Track tập trung vào năng lực phát triển sản phẩm on-chain trên Solana. Đội thi hướng đến một chương trình hoạt động trên Devnet, có kết nối ví và frontend, đồng thời cung cấp bằng chứng giao dịch trên Explorer.

Đây là nơi sinh viên thể hiện khả năng biến ý tưởng thành một sản phẩm kỹ thuật có thể hoạt động và kiểm chứng.

Hai track có trọng tâm khác nhau nhưng không tách rời nhau. Một sản phẩm kỹ thuật vẫn cần hiểu người dùng; một ý tưởng thị trường vẫn cần prototype đủ rõ để chứng minh giải pháp.

## Lộ Trình 14 Tuần

Hành trình UniHackFest 2026 được triển khai qua các giai đoạn:

1. **Official Kick-off:** Công bố chương trình, timeline, thể lệ và mở cổng đăng ký.
2. **UniTour:** Chuỗi workshop tại các trường đại học, giúp sinh viên tiếp cận AI, Web3, Solana và tư duy sản phẩm.
3. **Bootcamp Learning:** Giai đoạn đào tạo online và offline theo năm learning track.
4. **Qualification Round:** Các đội hoàn thiện prototype và pitching để cạnh tranh suất vào Final.
5. **Demo Day:** Final pitching, trao giải và kết nối với mentor, nhà đầu tư cùng đối tác hệ sinh thái.

Lộ trình này giúp sinh viên không phải tự tìm đường giữa quá nhiều kiến thức mới. Mỗi giai đoạn có mục tiêu, đầu ra và bước chuẩn bị rõ ràng cho chặng tiếp theo.

## Quy Mô Và Quyền Lợi Dành Cho Sinh Viên

Theo kế hoạch được công bố, UniHackFest 2026 hướng đến:

- **15 trường đại học** tham gia chuỗi hoạt động.
- **Hơn 2.000 sinh viên** được tiếp cận chương trình.
- **Năm khóa học thực chiến** từ thị trường đến kỹ thuật và pitching.
- **Tổng giá trị giải thưởng 10.000 USD**.
- **Một tháng Cora AI Student Plan miễn phí** dành cho sinh viên tham gia.

Bên cạnh giải thưởng, giá trị lớn hơn của chương trình nằm ở sản phẩm và trải nghiệm mà mỗi sinh viên có thể mang theo. Một Market Memo, MVP, dApp hoặc Pitch Deck hoàn chỉnh đều có thể trở thành bằng chứng năng lực trong portfolio.

## Kick-off Tại UEF Ngày 15/06/2026

UEF là đơn vị đồng tổ chức UniHackFest cùng Corelia Academy, đồng thời là nơi diễn ra Kick-off và điểm đầu tiên của chuỗi UniTour 2026.

Thông tin chương trình:

- **Địa điểm:** UEF – Đại học Kinh tế – Tài chính TP.HCM
- **Ngày tổ chức:** 15/06/2026
- **Thời gian:** 08:00–11:30
- **Nội dung:** Tổng quan UniHackFest, learning track, competition track, AI, Web3, tài sản số, giáo dục mở, Solana, Panel Q&A và networking

Sau UEF, UniTour sẽ tiếp tục đến các trường đại học khác. **Trường Đại học Hùng Vương TP.HCM (DHV)** là điểm dừng thứ hai của hành trình.

## Bắt Đầu Hành Trình Builder

Bạn không cần phải là chuyên gia AI hoặc Web3 trước khi đăng ký. UniHackFest được thiết kế để sinh viên học qua từng giai đoạn, tìm đồng đội có kỹ năng bổ trợ và phát triển sản phẩm thông qua nhiều vòng phản hồi.

Nếu chưa có team, bạn vẫn có thể đăng ký trước. Tên đội là thông tin không bắt buộc trong form. Hãy bắt đầu bằng vai trò mình tự tin nhất, sau đó kết nối với Developer, Designer hoặc Product/Business khác trong cộng đồng.

UniHackFest 2026 là lời mời dành cho những sinh viên muốn bước ra khỏi phạm vi bài tập trên lớp, trực tiếp xây dựng sản phẩm và kiểm chứng năng lực của chính mình.

**Tìm hiểu chương trình và đăng ký tại [unihackfest.vn](https://unihackfest.vn).**
$md$),
('vi', 'unihackfest-2026-xay-dung-lo-trinh-tu-giang-duong-den-builder', 'unihackfest-2026-university-to-builder-pipeline', 'case-study', 'published', $md$UniHackFest 2026: Xây Dựng Lộ Trình Từ Giảng Đường Đến Builder$md$, $md$Cách Corelia thiết kế hành trình AI và Web3 kéo dài 14 tuần, đưa sinh viên từ học tập và thấu hiểu thị trường đến sản phẩm hoạt động được, vòng kiểm chứng và Demo Day.$md$, 'corelia-team', 'community-success-stories', ARRAY['web3','ecosystem','mentorship','project-based','hackathon','dapp-development']::text[], '{"type":"image","src":"/blog/corelia-uef-khoi-dong-unihackfest-unitour-2026/UEF01929.jpg","alt":"Sinh viên, ban tổ chức và đối tác hệ sinh thái tại lễ khởi động UniHackFest 2026 ở UEF","fit":"cover"}'::jsonb, '2026-08-25'::date, '2026-08-25'::timestamptz, '2026-08-25'::timestamptz, $md$**Chương trình đổi mới sáng tạo dành cho sinh viên toàn quốc · AI × Web3**

Một cuộc hackathon có thể thu hút sự chú ý chỉ trong một cuối tuần. Nhưng để hình thành những student builder có năng lực, cần nhiều thời gian hơn thế.

UniHackFest 2026 được xây dựng từ chính khác biệt này. Do Corelia Academy và Trường Đại học Kinh tế – Tài chính TP.HCM (UEF) đồng tổ chức, UniHackFest là chương trình học tập kết hợp thi đấu kéo dài 14 tuần, giúp sinh viên đi từ nhận diện một vấn đề thực tế đến xây dựng, kiểm chứng và thuyết trình sản phẩm AI và Web3.

Thay vì yêu cầu sinh viên mang một ý tưởng hoàn chỉnh đến và lập tức bước vào cuộc thi, Corelia thiết kế chương trình dựa trên một nguyên tắc đơn giản: **học trước khi thi**.

## Bài Toán

Các hackathon sinh viên truyền thống thường nén toàn bộ hành trình trở thành builder vào vài ngày. Người tham gia có thể rất nhiệt huyết, nhưng lại bắt đầu với trình độ công nghệ, tư duy sản phẩm, hiểu biết thị trường và kinh nghiệm thuyết trình rất khác nhau.

Điều đó dẫn đến nhiều vấn đề. Một số đội dành gần hết thời gian thi để học công cụ thay vì xây sản phẩm. Một số khác tạo ra prototype thú vị về mặt kỹ thuật nhưng chưa hiểu người dùng hoặc thị trường. Sinh viên không chuyên công nghệ có thể chưa nhìn thấy vai trò của mình. Và khi Demo Day kết thúc, động lực học tập cũng dễ dàng biến mất.

Corelia muốn thiết kế một mô hình khác. Mục tiêu không chỉ là tạo ra thêm người tham dự hackathon, mà là xây dựng một **lộ trình có cấu trúc để đưa sinh viên trở thành builder**.

## Cách Tiếp Cận Của Corelia

![Sinh viên UEF tương tác trong buổi học UniHackFest](/blog/corelia-uef-khoi-dong-unihackfest-unitour-2026/UEF01864.jpg)

UniHackFest được thiết kế như một hệ thống liên kết thay vì tập hợp những sự kiện rời rạc. Sinh viên đi qua năm mảng học tập:

**Market Insight → AI Product Building → Rust Survival Kit → Solana Bootcamp → Pitching**

Mỗi chặng tạo ra một đầu ra cụ thể:

**Market Memo → AI Product MVP → Rust On-chain Lab → Solana dApp trên Devnet → Pitch Deck & Demo**

Nhờ đó, việc học gắn trực tiếp với sản phẩm mà người tham gia phải xây dựng và trình bày. Kiến thức thị trường giúp đội thi tìm ra một vấn đề đáng giải quyết. AI Product Building biến sự thấu hiểu đó thành MVP. Rust và Solana tạo nền tảng kỹ thuật cho sản phẩm on-chain có thể kiểm chứng. Pitching buộc các đội giải thích rõ mình đã xây gì, ai cần sản phẩm và vì sao sản phẩm có ý nghĩa.

Khi bước vào vòng loại và Demo Day, các đội được kỳ vọng trình bày bằng chứng về quá trình phát triển sản phẩm và năng lực thực thi kỹ thuật: không chỉ là một ý tưởng nằm trên slide.

## Một Hành Trình Builder Hoàn Chỉnh

### 1. UniTour: Khám Phá

Corelia đưa chương trình trực tiếp đến các trường đại học. Sinh viên được tiếp cận AI, tài sản số, Web3, Solana, tư duy sản phẩm, góc nhìn ngành và những vai trò cần thiết để xây dựng một sản phẩm công nghệ.

Mục tiêu không chỉ là quảng bá sự kiện. UniTour đóng vai trò lớp đầu vào của pipeline phát triển builder.

### 2. Học Tập Có Cấu Trúc: Thấu Hiểu

Sinh viên tiếp tục với các track học tập xoay quanh những năng lực cần có để xây một sản phẩm. Thay vì tiếp nhận nội dung công nghệ rời rạc, người học hiểu cách nghiên cứu thị trường, AI, lập trình, hạ tầng blockchain, quyết định sản phẩm và truyền thông kết nối với nhau.

### 3. Mentoring Và Xây Dựng: Ứng Dụng

Các đội biến kiến thức thành prototype. Mentor hỗ trợ tinh gọn phạm vi, xử lý vấn đề kỹ thuật, cải thiện quyết định sản phẩm và chuẩn bị cho vòng đánh giá.

### 4. Vòng Loại: Kiểm Chứng

Các đội phải chứng minh những gì mình thực sự đã xây dựng. Vòng loại tạo ra một checkpoint giữa học tập và thi đấu, nâng tiêu chuẩn trước khi các đội bước vào chặng cuối.

### 5. Demo Day: Trình Diễn Điều Hoạt Động Được

Những đội mạnh nhất kết hợp sản phẩm, công nghệ, hiểu biết thị trường và năng lực truyền đạt trong phần trình diễn cuối cùng.

Toàn bộ hành trình trở thành: **Khám phá → Học → Xây dựng → Kiểm chứng → Demo**.

## Đưa Hệ Sinh Thái Vào Hành Trình Đại Học

![Hoạt động UniHackFest kết nối sinh viên với hệ sinh thái](/blog/corelia-unihackfest-unitour-van-lang-2026/_DSC2776.jpg)

UniHackFest cũng cho thấy cách Corelia đóng vai trò giao diện kết nối các hệ sinh thái công nghệ toàn cầu với trường đại học Việt Nam.

Solana tham gia với vai trò đối tác hệ sinh thái blockchain về kỹ thuật, trong khi MEXC Ventures đóng góp góc nhìn thị trường và tài sản số. Những đơn vị đồng hành khác trong chương trình mở rộng còn có Open Campus, cộng đồng developer, chuyên gia trong ngành và các đối tác đại học.

Thay vì chỉ đặt logo đối tác quanh một sự kiện kéo dài một ngày, chương trình tích hợp tri thức hệ sinh thái vào hành trình thực tế của sinh viên. Các bạn gặp gỡ hệ sinh thái tại trường, học công nghệ qua khóa học có cấu trúc, sử dụng công nghệ khi xây sản phẩm, nhận phản hồi từ người thực hành và cuối cùng trình diễn những gì mình có thể tạo ra.

Điều này chuyển hoạt động tài trợ hệ sinh thái từ **hiện diện thương hiệu** thành **tham gia thực chất và phát triển builder**.

## Từ Một Trường Đến Chương Trình Đa Thành Phố

![Chương trình UniHackFest Da Nang Campus](/blog/corelia-unihackfest-da-nang-campus-2026/IMG_1745.jpg)

UniHackFest chính thức khởi động tại UEF vào ngày 15/06/2026. Hành trình sau đó mở rộng qua các hoạt động tại Đại học Hùng Vương TP.HCM, ITC, Đại học Văn Lang, Học viện Kỹ thuật Mật mã cơ sở TP.HCM, Đại học Văn Hiến và chương trình Da Nang Campus phối hợp cùng BTEC FPT Đà Nẵng và DUT Superteam University Club.

Thiết kế ban đầu hướng đến hành trình qua 15 trường đại học và hơn 2.000 sinh viên, với năm khóa học thực hành cùng hai hướng thi Product & Business và Technical Build. Đây vẫn là những mục tiêu ở quy mô toàn chương trình cho đến khi chu kỳ 2026 hoàn tất.

Tính đến ngày 25/08/2026, UniHackFest vẫn đang diễn ra. Sự phân biệt này rất quan trọng. Bằng chứng thuyết phục nhất hiện tại không phải một con số người tham dự cuối cùng, mà là việc mô hình đã vượt khỏi phạm vi của một lễ khởi động để trở thành chuỗi hoạt động lặp lại về kích hoạt cộng đồng tại trường, học tập, phát triển ý tưởng, đào tạo kỹ thuật và chuẩn bị builder tại nhiều cộng đồng đại học.

## Vai Trò Của Corelia

Corelia đảm nhiệm vai trò **lớp kiến trúc chương trình và giáo dục** phía sau toàn bộ hành trình, bao gồm:

**Thiết kế chương trình · Phát triển giáo trình · Quan hệ đối tác đại học · Điều phối hệ sinh thái · Kích hoạt tại trường · Mentorship · Đào tạo kỹ thuật · Thiết kế vòng loại · Xây dựng cộng đồng**

Công việc bắt đầu trước khi một sự kiện được công bố và tiếp tục rất lâu sau khi sinh viên rời buổi workshop đầu tiên. Chính tính liên tục đó biến một chuỗi hoạt động thành một chương trình.

## Vì Sao Case Study Này Quan Trọng

UniHackFest là thử nghiệm lớn nhất của Corelia trong việc kết hợp ba yếu tố thường bị tách rời: **giáo dục, kích hoạt hệ sinh thái và xây dựng sản phẩm**.

Một workshop tại trường có thể tạo nhận thức. Một khóa học có thể tạo kiến thức. Một hackathon có thể tạo động lực hành động. Nhưng khi những thành phần này được thiết kế thành một hành trình thống nhất, chúng tạo ra điều có giá trị hơn: một pipeline có thể lặp lại để sinh viên khám phá công nghệ, học cách công nghệ vận hành, xây dựng với nó, chứng minh năng lực và tiếp tục kết nối với hệ sinh thái sau chương trình.

Với Corelia, UniHackFest không chỉ là một hackathon. Đây là mô hình cho cách trường đại học và hệ sinh thái công nghệ có thể cùng phát triển thế hệ builder tiếp theo.

**Học → Xây dựng → Kiểm chứng → Đưa sản phẩm ra thực tế**

### Corelia Academy

**Từ giảng đường đến những builder thực thụ.**
$md$),
('vi', 'unihackfest-unitour-2-dhv-web3-solana-2026', 'unihackfest-unitour-2-dhv-web3-solana-2026', 'blog', 'published', $md$UniHackFest UniTour #2 Tại DHV: Từ Web3 Growth Hacking Đến Hành Trình Builder Trên Solana$md$, $md$Ngày 18/06/2026, UniHackFest UniTour #2 tại Trường Đại học Hùng Vương TP.HCM mang đến các góc nhìn từ MEXC Ventures, Open Campus và cộng đồng Solana về nội dung, giáo dục Web3 và hành trình builder bền vững.$md$, 'corelia-team', 'announcements-events', ARRAY['web3','blockchain-fundamentals','dapp-development','ecosystem','project-based','hackathon']::text[], '{"type":"image","src":"/blog/unihackfest-unitour-2-dhv-web3-solana-2026/IMG_3105_SnapseedCopy.jpg","alt":"UniHackFest UniTour thứ hai tại Trường Đại học Hùng Vương TP.HCM","fit":"cover"}'::jsonb, '2026-06-18'::date, '2026-06-18'::timestamptz, '2026-06-18'::timestamptz, $md$Ngày **18/06/2026**, hành trình **UniHackFest UniTour 2026** tiếp tục đến với **Trường Đại học Hùng Vương TP.HCM (DHV)** trong điểm dừng thứ hai của chuỗi hoạt động tại các trường đại học.

Nối tiếp Kick-off và UniTour #1 tại UEF, workshop tại DHV đưa sinh viên đến gần hơn với những góc nhìn thực tế về Web3 Growth Hacking, đổi mới giáo dục trong Web3 và hành trình phát triển sản phẩm bền vững trên Solana.

Ba phiên chia sẻ đến từ **Ms. Jenny Nguyen – MEXC Ventures**, **Mr. Cris D. Tran – Open Campus** và **Mr. Le Quang Dat – Solana Builder, Superteam APAC Contributor**. Mỗi nội dung mở ra một lớp khác nhau trong hành trình của một builder: biết cách truyền tải sản phẩm đến cộng đồng, hiểu cách Web3 thay đổi giáo dục và duy trì con đường xây dựng công nghệ từ con số 0.

![UniHackFest UniTour #2 Tại DHV: Từ Web3 Growth Hacking Đến Hành Trình Builder Trên Solana](/blog/unihackfest-unitour-2-dhv-web3-solana-2026/IMG_3095.jpg)

## DHV – Điểm Dừng Thứ Hai Của UniHackFest UniTour 2026

![UniHackFest UniTour #2 Tại DHV: Từ Web3 Growth Hacking Đến Hành Trình Builder Trên Solana](/blog/unihackfest-unitour-2-dhv-web3-solana-2026/IMG_3102.jpg)

UniHackFest được thiết kế như hành trình học và thi trong 14 tuần, đưa sinh viên từ market insight, AI product thinking đến sản phẩm Web3 có thể demo và pitching. UniTour là cánh cửa đưa hành trình ấy đến trực tiếp các campus.

Sau điểm mở màn tại UEF ngày 15/06, DHV trở thành chặng thứ hai vào ngày 18/06. Workshop giúp sinh viên hiểu rằng Web3 không chỉ là một nhóm khái niệm kỹ thuật. Đây còn là không gian giao nhau giữa nội dung, cộng đồng, giáo dục, công nghệ và sản phẩm.

Đối với người mới, một workshop tại campus có thể là bước đầu để xác định mình phù hợp với vai trò nào. Developer có thể tập trung vào sản phẩm và hạ tầng kỹ thuật. Designer giúp xây dựng trải nghiệm. Product/Business nghiên cứu người dùng và thị trường. Những bạn mạnh về nội dung hoặc cộng đồng cũng đóng vai trò quan trọng trong cách sản phẩm tiếp cận Gen Z và tạo ra tăng trưởng.

## Web3 Growth Hacking – Breakthrough Content Creation for Gen Z

![UniHackFest UniTour #2 Tại DHV: Từ Web3 Growth Hacking Đến Hành Trình Builder Trên Solana](/blog/unihackfest-unitour-2-dhv-web3-solana-2026/IMG_3103.jpg)

Đại diện **MEXC Ventures**, **Ms. Jenny Nguyen** mang đến chủ đề **“Web3 Growth Hacking – Breakthrough Content Creation for Gen Z”**.

Một sản phẩm có nền tảng công nghệ tốt vẫn cần được người dùng hiểu, tin tưởng và lựa chọn. Với Gen Z: thế hệ tiếp nhận thông tin nhanh, tương tác qua nhiều nền tảng và nhạy cảm với những nội dung thiếu tính chân thực: cách truyền tải sản phẩm trở thành một phần quan trọng của chiến lược tăng trưởng.

Phiên chia sẻ đặt nội dung trong bối cảnh xây dựng sản phẩm Web3. Growth Hacking không chỉ là tạo ra nhiều lượt xem; đó là quá trình thử nghiệm thông điệp, kênh tiếp cận và cách kích hoạt cộng đồng để tìm ra hướng tăng trưởng phù hợp.

Đối với sinh viên tham gia UniHackFest, góc nhìn này đặc biệt hữu ích khi hoàn thiện market insight, chiến lược tiếp cận người dùng và phần pitching. Một đội cần giải thích được sản phẩm của mình dành cho ai, vì sao vấn đề đáng được quan tâm và điều gì khiến người dùng muốn trải nghiệm.

## Open Campus: Education & Innovation in Web3

![UniHackFest UniTour #2 Tại DHV: Từ Web3 Growth Hacking Đến Hành Trình Builder Trên Solana](/blog/unihackfest-unitour-2-dhv-web3-solana-2026/IMG_3104.jpg)

Đại diện **Open Campus**, **Mr. Cris D. Tran** chia sẻ chủ đề **“Open Campus: Education & Innovation in Web3”**.

Giáo dục là một trong những lĩnh vực có nhiều không gian để thử nghiệm với Web3. Các mô hình mở có thể tạo ra cách tiếp cận mới trong việc ghi nhận năng lực, quản lý danh tính học tập, kết nối người học với nội dung và trao thêm quyền sở hữu đối với thành quả giáo dục.

Với sinh viên, đổi mới giáo dục không phải câu chuyện quá xa vời. Mỗi đồ án, kỹ năng và đóng góp trong dự án đều là một phần của hành trình phát triển năng lực. Khi những kết quả này có thể được ghi nhận và xác minh rõ ràng hơn, khoảng cách giữa quá trình học và cơ hội nghề nghiệp cũng có thể được thu hẹp.

Chủ đề từ Open Campus mở rộng không gian ý tưởng cho các đội UniHackFest. Web3 có thể được ứng dụng không chỉ trong tài chính, mà còn trong chứng nhận số, cộng đồng học tập, nội dung giáo dục và nhiều bài toán liên quan đến phát triển tài năng.

## From Zero to Sustainable: A Builder’s Journey on Solana

![UniHackFest UniTour #2 Tại DHV: Từ Web3 Growth Hacking Đến Hành Trình Builder Trên Solana](/blog/unihackfest-unitour-2-dhv-web3-solana-2026/IMG_3101.jpg)

**Mr. Le Quang Dat – Solana Builder, Superteam APAC Contributor** mang đến chủ đề **“From Zero to Sustainable: A Builder’s Journey on Solana”**.

Bắt đầu xây dựng một sản phẩm luôn dễ hơn duy trì hành trình đủ lâu để sản phẩm trưởng thành. Từ con số 0, một builder cần liên tục học công nghệ, xác định đúng vấn đề, thử nghiệm giải pháp, nhận phản hồi và cải tiến.

Sự bền vững không chỉ nằm ở kiến trúc kỹ thuật. Nó còn đến từ khả năng làm việc cùng cộng đồng, xây đội ngũ, lựa chọn phạm vi phù hợp và tiếp tục phát triển sau những cột mốc ngắn hạn như Hackathon.

Đối với sinh viên quan tâm đến Solana, câu chuyện builder giúp kết nối learning track với con đường dài hơn. Rust Survival Kit và Solana Bootcamp cung cấp nền tảng để các đội xây dApp trên Devnet; nhưng tư duy học hỏi và cải tiến mới là yếu tố giúp một dự án tiếp tục tồn tại sau Demo Day.

## Từ Workshop Đến Hành Trình 14 Tuần

![UniHackFest UniTour #2 Tại DHV: Từ Web3 Growth Hacking Đến Hành Trình Builder Trên Solana](/blog/unihackfest-unitour-2-dhv-web3-solana-2026/IMG_3098.jpg)

Ba chủ đề tại DHV phản ánh ba câu hỏi mà một builder trẻ cần trả lời:

- Làm thế nào để sản phẩm được cộng đồng biết đến và đón nhận?
- Công nghệ có thể tạo ra những mô hình giáo dục mới như thế nào?
- Làm sao để bắt đầu từ con số 0 và duy trì hành trình xây dựng đủ lâu?

UniHackFest giúp sinh viên tiếp tục tìm câu trả lời qua năm learning track: Market Insight, AI Product Building, Rust Survival Kit, Solana Bootcamp và Pitching. Mỗi phần tạo ra một đầu ra cụ thể trước khi đội thi bước vào Qualification Round và Demo Day.

Workshop tại DHV vì thế không đứng riêng như một buổi truyền cảm hứng. Đây là điểm kết nối sinh viên với toàn bộ hệ thống học tập, thực hành và thi đấu của chương trình.

## Góc Nhìn Corelia: Builder Cần Công Nghệ, Sản Phẩm Và Cộng Đồng

![UniHackFest UniTour #2 Tại DHV: Từ Web3 Growth Hacking Đến Hành Trình Builder Trên Solana](/blog/unihackfest-unitour-2-dhv-web3-solana-2026/IMG_3099.jpg)

![UniHackFest UniTour #2 Tại DHV: Từ Web3 Growth Hacking Đến Hành Trình Builder Trên Solana](/blog/unihackfest-unitour-2-dhv-web3-solana-2026/IMG_3100.jpg)

Với vai trò đồng tổ chức UniHackFest cùng UEF, Corelia Academy theo đuổi một mô hình trong đó sinh viên không chỉ học để biết mà học để tạo ra đầu ra thực tế.

Điểm dừng tại DHV cho thấy hành trình builder không chỉ thuộc về lập trình viên. Một sản phẩm cần người hiểu công nghệ, người hiểu thị trường, người thiết kế trải nghiệm và người có khả năng truyền tải giá trị đến cộng đồng.

Khi những năng lực này được kết nối trong một đội, Hackathon trở thành môi trường để sinh viên thử nghiệm cách làm việc gần hơn với thực tế: xác định vấn đề, phân chia vai trò, xây MVP, kiểm chứng sản phẩm và trình bày kết quả.

UniTour là bước đầu giúp sinh viên nhìn thấy bức tranh ấy. Những chặng tiếp theo của chương trình sẽ đưa các đội đi sâu hơn vào học tập và xây dựng.

## Tiếp Tục Hành Trình UniTour

DHV đã trở thành điểm dừng thứ hai sau UEF trong chuỗi UniHackFest UniTour 2026. Từ đây, hành trình tiếp tục đến các campus khác, kết nối thêm nhiều sinh viên với AI, Web3, Solana và tư duy xây dựng sản phẩm.

Corelia Academy sẽ tiếp tục đồng hành cùng UEF, các đối tác và cộng đồng để tạo nên một sân chơi nơi sinh viên có thể học thật, build thật và đưa năng lực của mình vào những sản phẩm có thể trình diễn.

**Tìm hiểu hành trình và đăng ký tại [unihackfest.vn](https://unihackfest.vn).**
$md$),
('vi', 'unihackfest-unitour-itc-ai-blockchain-web3-2026', 'unihackfest-unitour-itc-ai-blockchain-web3-2026', 'blog', 'published', $md$UniHackFest UniTour x ITC: Khởi Động Tháng 7 Với AI, Blockchain Và Web3$md$, $md$Ngày 01/07/2026, Trường Cao đẳng Công nghệ Thông tin TP.HCM phối hợp cùng Corelia Academy tổ chức Workshop UniHackFest UniTour x ITC, kết nối sinh viên với AI, Blockchain, Web3, Digital Assets và Smart Contract.$md$, 'corelia-team', 'announcements-events', ARRAY['web3','blockchain-fundamentals','smart-contracts','ecosystem','project-based','hackathon']::text[], '{"type":"image","src":"/blog/unihackfest-unitour-itc-ai-blockchain-web3-2026/4.jpg","alt":"UniHackFest UniTour x ITC","fit":"cover"}'::jsonb, '2026-07-01'::date, '2026-07-01'::timestamptz, '2026-07-01'::timestamptz, $md$Sáng **01/07/2026**, Trường Cao đẳng Công nghệ Thông tin TP.HCM (**ITC**) phối hợp cùng **Corelia Academy** tổ chức thành công Workshop **"UniHackFest UniTour x ITC"**. Sự kiện mở đầu tháng 7 bằng một không gian học thuật và kết nối dành cho sinh viên yêu thích công nghệ, nơi các bạn được tiếp cận những xu hướng tiên phong như **AI, Blockchain, Web3, Digital Assets** và **Smart Contract**.

Không chỉ là một buổi chia sẻ kiến thức, UniTour x ITC còn là điểm chạm giữa nhà trường, doanh nghiệp, chuyên gia và hệ sinh thái công nghệ. Thông qua chương trình, sinh viên có thêm góc nhìn thực tiễn về những lĩnh vực đang định hình kỷ nguyên số, đồng thời chuẩn bị tinh thần để bước vào hành trình **UniHackFest 2026**.

## Khởi Động Tháng 7 Cùng UniHackFest UniTour x ITC

![UniHackFest UniTour x ITC: Khởi Động Tháng 7 Với AI, Blockchain Và Web3](/blog/unihackfest-unitour-itc-ai-blockchain-web3-2026/14.jpg)

UniHackFest UniTour được thiết kế để đưa tinh thần học, xây dựng và trình diễn sản phẩm đến trực tiếp các campus. Tại ITC, chương trình tập trung vào việc giúp sinh viên hiểu rõ hơn về bức tranh công nghệ mới: AI đang thay đổi cách con người làm việc và sáng tạo; Blockchain mở ra hạ tầng tin cậy mới cho dữ liệu và tài sản số; Web3 tạo thêm không gian để người trẻ tham gia xây dựng sản phẩm toàn cầu.

Với sinh viên công nghệ thông tin, những chủ đề này không còn là khái niệm xa lạ trên tin tức. Chúng đang trở thành năng lực nghề nghiệp, tư duy sản phẩm và cơ hội phát triển dự án. Workshop vì vậy đóng vai trò như một cánh cửa mở, giúp sinh viên nhìn thấy cách kiến thức trong lớp học có thể kết nối với nhu cầu thực tế của doanh nghiệp và thị trường.

## Sự Đồng Hành Từ ITC Và Cộng Đồng Sinh Viên

![UniHackFest UniTour x ITC: Khởi Động Tháng 7 Với AI, Blockchain Và Web3](/blog/unihackfest-unitour-itc-ai-blockchain-web3-2026/11.jpg)

Tham dự chương trình, về phía ITC có **ThS. Lư Quốc Tuấn - Phó Hiệu trưởng**; **ThS. Trần Trung Việt - Phó Hiệu trưởng**; Trưởng, Phó Khoa Công nghệ thông tin - Điện tử; quý Thầy, Cô cùng đông đảo sinh viên Khoa CNTT - Điện tử.

Sự hiện diện của lãnh đạo nhà trường, đội ngũ giảng viên và sinh viên cho thấy định hướng kết nối đào tạo với trải nghiệm thực tế đang ngày càng được chú trọng. Trong bối cảnh công nghệ thay đổi nhanh, sinh viên cần nhiều hơn kiến thức nền tảng: các bạn cần cơ hội tiếp xúc với chuyên gia, quan sát cách doanh nghiệp nhìn nhận bài toán và thử sức trong môi trường xây dựng sản phẩm.

## Kết Nối Doanh Nghiệp Và Hệ Sinh Thái Công Nghệ

![UniHackFest UniTour x ITC: Khởi Động Tháng 7 Với AI, Blockchain Và Web3](/blog/unihackfest-unitour-itc-ai-blockchain-web3-2026/1.jpg)

Về phía doanh nghiệp và khách mời, chương trình có sự tham dự của đại diện **Corelia Academy**, **Chainlink**, **Nghiên AI**, **Công ty CTW SEVINA**, cùng đại diện Trường Đại học Hùng Vương TP.HCM, Trường Đại học Văn Hiến và Trường Đại học Gia Định.

Sự góp mặt của các đơn vị trong hệ sinh thái giúp workshop trở thành một diễn đàn kết nối đa chiều. Sinh viên không chỉ nghe về xu hướng công nghệ, mà còn được tiếp cận những góc nhìn đến từ đào tạo, doanh nghiệp, cộng đồng phát triển và các trường đối tác.

Đây là một điểm quan trọng của UniHackFest: cuộc thi không chỉ tìm kiếm ý tưởng, mà còn tạo môi trường để sinh viên học cách đặt câu hỏi đúng, kết nối nguồn lực phù hợp và phát triển sản phẩm theo hướng có giá trị thực tiễn.

## Hai Góc Nhìn Chuyên Sâu Về AI Agents Và Blockchain

Bên cạnh phần kết nối tổng quan về AI, Blockchain và Web3, chương trình tại ITC còn mang đến hai phần chia sẻ chuyên sâu, giúp sinh viên nhìn rõ hơn cách AI Agents và blockchain đang mở ra thế hệ ứng dụng tiếp theo.

### Mai Thanh Nhã: Khi AI Agents Cần Một Lớp Hạ Tầng Đáng Tin Cậy

![UniHackFest UniTour x ITC: Khởi Động Tháng 7 Với AI, Blockchain Và Web3](/blog/unihackfest-unitour-itc-ai-blockchain-web3-2026/10.jpg)

AI đang phát triển rất nhanh, nhưng câu hỏi lớn hơn là điều gì sẽ xảy ra khi AI có thể tự đưa ra quyết định, tự thanh toán và tự tương tác với các hệ thống số. Trong phần chia sẻ tại UniHackFest UniTour x ITC, **Mai Thanh Nhã** mang đến góc nhìn tổng quan về **AI Agents**, blockchain và cách hai công nghệ này đang kết hợp để tạo nên những mô hình ứng dụng mới.

Nội dung đi qua các khái niệm quan trọng như **Agentic AI, AI Agents, tokenization, Real World Assets (RWA), on-chain data** và **micro-payments**. Từ đó, sinh viên có thể hình dung vì sao blockchain không chỉ là hạ tầng cho tài sản số, mà còn có thể trở thành lớp tin cậy giúp AI hoạt động minh bạch, có thể kiểm chứng và tự chủ hơn trong nền kinh tế số.

Góc nhìn này đặc biệt hữu ích với những bạn đang bắt đầu xây dựng sản phẩm trong kỷ nguyên AI. Khi AI có thể ra quyết định và thực hiện hành động thay người dùng, các vấn đề như dữ liệu, quyền sở hữu, thanh toán, xác thực và niềm tin sẽ trở thành một phần quan trọng của thiết kế sản phẩm.

### Jack Vĩ Từ Nghiên AI: Từ Chatbot Đến Workflow AI Và Bộ Não Thứ Hai

![UniHackFest UniTour x ITC: Khởi Động Tháng 7 Với AI, Blockchain Và Web3](/blog/unihackfest-unitour-itc-ai-blockchain-web3-2026/8.jpg)

Tiếp nối chương trình, **Jack Vĩ** từ cộng đồng **Nghiên AI** đặt ra một câu hỏi gần gũi với sinh viên: điều gì sẽ xảy ra nếu AI không chỉ là một chatbot được mở lên khi cần, mà trở thành một hệ thống có thể hiểu context, sắp xếp kiến thức và sử dụng ứng dụng thay cho con người.

Phần chia sẻ giới thiệu một framework thực tế gồm năm yếu tố ảnh hưởng trực tiếp đến chất lượng đầu ra của AI: **model, tool, prompt, context** và **skill**. Trong đó, context được nhấn mạnh như một yếu tố rất quan trọng nhưng thường bị bỏ qua. Jack Vĩ gợi ý cách sinh viên có thể tổ chức tài liệu, ghi chú, ảnh chụp màn hình, nguồn nghiên cứu và kiến thức dự án thành một hệ thống mà nhiều AI agent khác nhau đều có thể làm việc cùng.

Nội dung cũng mở ra một thay đổi lớn trong cách con người tương tác với công nghệ. Thay vì tự mở từng ứng dụng và xử lý từng tác vụ thủ công, người dùng sẽ ngày càng giao nhiệm vụ cho AI agent: xử lý file, phân tích dữ liệu, tổng hợp nội dung học tập, tạo slide và hoàn thành các workflow số.

Với sinh viên, đây là một góc nhìn thực tế để vượt ra khỏi việc chỉ "prompt" đơn lẻ. Khi biết xây dựng kho kiến thức cá nhân và workflow AI của riêng mình, các bạn có thể giảm tình trạng AI bịa thông tin, học tập hiệu quả hơn và chuẩn bị tốt hơn cho quá trình xây dựng sản phẩm cùng AI.

## Cập Nhật Kiến Thức Về AI, Blockchain, Web3 Và Smart Contract

Thông qua những chia sẻ từ các chuyên gia, sinh viên ITC được cập nhật kiến thức thực tiễn về **AI, Blockchain, Web3, Digital Assets** và **Smart Contract**. Các nội dung này giúp người học mở rộng góc nhìn từ công nghệ đơn lẻ sang hệ thống sản phẩm và hệ sinh thái.

AI mang đến khả năng tự động hóa, hỗ trợ ra quyết định và xây dựng trải nghiệm người dùng thông minh hơn. Blockchain và Smart Contract giúp sinh viên hình dung cách các quy tắc có thể được lập trình, kiểm chứng và vận hành minh bạch trên hạ tầng phi tập trung. Digital Assets mở ra một lớp giá trị mới, nơi quyền sở hữu, giao dịch và dữ liệu có thể được thể hiện bằng các mô hình số.

Khi được đặt cạnh nhau, những công nghệ này gợi mở nhiều hướng phát triển sản phẩm cho sinh viên: từ ứng dụng giáo dục, tài chính, quản trị cộng đồng, chứng chỉ số, dữ liệu học tập đến các giải pháp hỗ trợ doanh nghiệp. Đây cũng chính là tinh thần của UniHackFest 2026: học để hiểu, xây để kiểm chứng và trình diễn để nhận phản hồi.

## Cầu Nối Giữa Nhà Trường, Doanh Nghiệp Và Sinh Viên

![UniHackFest UniTour x ITC: Khởi Động Tháng 7 Với AI, Blockchain Và Web3](/blog/unihackfest-unitour-itc-ai-blockchain-web3-2026/7.jpg)

Workshop không chỉ là diễn đàn học thuật mà còn là cầu nối giữa nhà trường, doanh nghiệp và sinh viên. Với nhà trường, đây là cơ hội mở rộng kết nối với hệ sinh thái công nghệ. Với doanh nghiệp và chuyên gia, chương trình tạo thêm kênh tiếp cận thế hệ nhân lực trẻ. Với sinh viên, đây là dịp để hiểu rõ hơn mình cần chuẩn bị những kỹ năng nào để tự tin bước vào kỷ nguyên số.

UniHackFest 2026 tiếp tục hành trình đồng hành cùng sinh viên thông qua các hoạt động học tập, mentoring, xây dựng dự án và trình diễn sản phẩm. Từ những buổi UniTour như tại ITC, sinh viên có thể bắt đầu tìm kiếm đồng đội, xác định vấn đề muốn giải quyết và chuẩn bị cho chặng đường phát triển ý tưởng thành sản phẩm thật.

<!-- IMAGE_SLOT: Thêm ảnh sinh viên giao lưu, đặt câu hỏi hoặc networking sau workshop tại đây. -->

## Sẵn Sàng Chinh Phục UniHackFest 2026

UniHackFest UniTour x ITC khép lại với nhiều tín hiệu tích cực: sinh viên được tiếp cận kiến thức mới, nhà trường và doanh nghiệp tăng cường kết nối, còn hệ sinh thái công nghệ có thêm cơ hội đồng hành cùng các builder trẻ.

Với nền tảng từ workshop, sinh viên ITC có thêm động lực để khám phá AI, Blockchain và Web3 sâu hơn, đồng thời sẵn sàng thử sức tại UniHackFest 2026. Mỗi câu hỏi, mỗi ý tưởng và mỗi cuộc gặp gỡ tại UniTour đều có thể trở thành bước khởi đầu cho một dự án có giá trị trong tương lai.

**Tìm hiểu lộ trình và đăng ký tại [unihackfest.vn](https://unihackfest.vn/vi/).**
$md$),
('vi', 'vi-sao-corelia-dong-to-chuc-unihackfest-2026', 'vi-sao-corelia-dong-to-chuc-unihackfest-2026', 'blog', 'published', $md$Vì Sao Corelia Đồng Tổ Chức UniHackFest 2026?$md$, $md$Góc nhìn từ Corelia Academy về mô hình học trước – thi sau, hành trình phát triển sản phẩm AI & Web3 trong 14 tuần và mục tiêu kết nối sinh viên với doanh nghiệp tại UniHackFest 2026.$md$, 'corelia-team', 'announcements-events', ARRAY['web3','hackathon','project-based','ecosystem','mentorship','career-tips']::text[], '{"type":"image","src":"/blog/vi-sao-corelia-dong-to-chuc-unihackfest-2026/_DSC0898.jpg","alt":"Corelia Academy đồng tổ chức UniHackFest 2026","fit":"cover"}'::jsonb, '2026-06-23'::date, '2026-06-23'::timestamptz, '2026-06-23'::timestamptz, $md$Với Corelia Academy, một Hackathon dành cho sinh viên không nên bắt đầu bằng đồng hồ đếm ngược và kết thúc ngay sau lễ trao giải. Giá trị lớn nhất phải nằm ở hành trình trước đó: người học được trang bị nền tảng, hiểu thị trường, hình thành tư duy sản phẩm, xây dựng công nghệ và học cách trình bày một giải pháp có thể kiểm chứng.

Đó là lý do Corelia Academy đồng tổ chức **UniHackFest 2026** cùng **Đại học Kinh tế – Tài chính TP.HCM (UEF)**. Đây là chương trình học và thi kéo dài 14 tuần, đưa sinh viên từ giảng đường đến quá trình xây dựng, hoàn thiện và pitching những sản phẩm AI & Web3 thực tế.

Theo thông tin được công bố trên [website chính thức của UniHackFest](https://unihackfest.vn/vi/?utm_source=corelia.academy&utm_medium=referral&utm_campaign=unihackfest_2026&utm_content=organizer_story), chương trình hướng đến kết nối 15 trường đại học, hơn 2.000 sinh viên, năm khóa học thực chiến và tổng giá trị giải thưởng 10.000 USD. Nhưng phía sau những con số đó là một câu hỏi quan trọng hơn: làm thế nào để mỗi sinh viên tham gia đều thực sự tiến bộ, kể cả khi không bước lên bục nhận giải?

<!-- IMAGE_SLOT: Thay comment này bằng: ![Corelia Academy và UEF tại Kick-off UniHackFest 2026](/blog/TEN-ANH.jpg) -->

## 1. Từ Một Cuộc Thi Ngắn Hạn Thành Hành Trình Phát Triển Năng Lực

![Vì Sao Corelia Đồng Tổ Chức UniHackFest 2026?](/blog/vi-sao-corelia-dong-to-chuc-unihackfest-2026/UEF01929.jpg)

Hackathon truyền thống thường tạo ra một môi trường giàu năng lượng: các đội tập trung cao độ, phát triển sản phẩm trong thời gian ngắn và trình bày trước Ban Giám khảo. Tuy nhiên, với sinh viên mới tiếp cận AI, Web3 hoặc phát triển sản phẩm, việc phải bắt đầu ngay từ một ý tưởng lớn có thể tạo ra khoảng cách đáng kể giữa mong muốn và năng lực thực tế.

UniHackFest được thiết kế để thu hẹp khoảng cách ấy. Thay vì yêu cầu người học phải biết mọi thứ ngay từ đầu, chương trình chia hành trình thành các bước có đầu ra rõ ràng. Sinh viên đi từ nghiên cứu thị trường đến xây MVP, học nền tảng kỹ thuật, đưa sản phẩm lên môi trường có thể kiểm chứng và hoàn thiện kỹ năng pitching.

Với Corelia, cách tiếp cận này phản ánh đúng triết lý đào tạo thực chiến:

- **Học để tạo ra đầu ra cụ thể**, không chỉ hoàn thành bài kiểm tra lý thuyết.
- **Xây dựng theo từng lớp năng lực**, để người mới có thể bắt đầu nhưng vẫn có không gian cho đội ngũ giàu kinh nghiệm bứt phá.
- **Nhận phản hồi trong quá trình phát triển**, thay vì chỉ nhận kết quả ở vòng chấm giải cuối cùng.
- **Kết nối kiến thức với bối cảnh thị trường**, giúp sinh viên hiểu vì sao một sản phẩm cần được xây dựng.

Một cuộc thi có thể tìm ra đội chiến thắng. Một hành trình đào tạo tốt phải giúp hình thành thêm nhiều builder có khả năng tiếp tục học, làm và tạo ra giá trị sau cuộc thi.

## 2. “Học Trước – Thi Sau” Không Phải Khẩu Hiệu

![Vì Sao Corelia Đồng Tổ Chức UniHackFest 2026?](/blog/vi-sao-corelia-dong-to-chuc-unihackfest-2026/_DSC1075.jpg)

Lộ trình UniHackFest gồm năm nội dung thực chiến: **Market Insight, AI Product Building, Rust Survival Kit, Solana Bootcamp và Pitching**. Mỗi phần giải quyết một mắt xích thường bị thiếu khi sinh viên lần đầu xây dựng sản phẩm.

### Market Insight: Bắt Đầu Từ Vấn Đề Thật

![Vì Sao Corelia Đồng Tổ Chức UniHackFest 2026?](/blog/vi-sao-corelia-dong-to-chuc-unihackfest-2026/UEF01580.jpg)

Một sản phẩm tốt không bắt đầu từ việc chọn công nghệ đang được chú ý nhất. Nó bắt đầu từ việc hiểu người dùng, bối cảnh thị trường và vấn đề cần giải quyết. Market Insight giúp các đội tránh xây một giải pháp chỉ vì “có thể xây”, đồng thời đặt nền móng cho cách xác định quy mô cơ hội và hướng tiếp cận thị trường.

### AI Product Building: Biến Insight Thành MVP

Khi vấn đề đã rõ, sinh viên cần học cách chuyển nó thành một sản phẩm tối thiểu có thể thử nghiệm. AI Product Building hướng các đội đến tư duy ưu tiên: tính năng nào là cốt lõi, giả định nào cần kiểm chứng trước và AI nên đóng vai trò gì trong trải nghiệm sản phẩm.

### Rust Và Solana: Từ Ý Tưởng Đến Sản Phẩm On-chain

Rust Survival Kit và Solana Bootcamp tạo nên lớp kỹ thuật cho hành trình. Người học từng bước tiếp cận lập trình, kiến trúc on-chain và cách phát triển một dApp trên Solana Devnet. Sản phẩm không chỉ tồn tại trong slide; đội thi cần tiến đến trạng thái có thể kết nối ví, thực hiện giao dịch và cung cấp bằng chứng kiểm chứng trên Explorer.

### Pitching: Làm Rõ Giá Trị Đã Tạo Ra

Pitching không phải bước trang trí sau khi code đã hoàn thành. Đây là lúc đội ngũ chứng minh mình hiểu vấn đề, lựa chọn giải pháp có chủ đích và có thể truyền đạt giá trị đến người dùng, giám khảo, đối tác hoặc nhà đầu tư.

Năm phần học kết nối thành một chuỗi đầu ra: **Market Memo → AI Product MVP → Rust On-chain Lab → Solana dApp Devnet → Pitch Deck và Demo**. Đó là cách “học trước – thi sau” được chuyển thành một quy trình có thể thực hiện và đánh giá.

<!-- IMAGE_SLOT: Thay comment này bằng: ![Lộ trình năm khóa học thực chiến của UniHackFest](/blog/TEN-ANH.jpg) -->

## 3. Vì Sao Corelia Chọn Vai Trò Đồng Tổ Chức?

![Vì Sao Corelia Đồng Tổ Chức UniHackFest 2026?](/blog/vi-sao-corelia-dong-to-chuc-unihackfest-2026/UEF01722.jpg)

Corelia Academy theo đuổi mục tiêu đưa giáo dục công nghệ đến gần hơn với cách sản phẩm được xây dựng trong thực tế. Đồng tổ chức UniHackFest là cơ hội để mục tiêu đó được triển khai ở quy mô liên trường, với sự tham gia của nhà trường, doanh nghiệp, chuyên gia kỹ thuật và các đối tác hệ sinh thái.

Vai trò của một đơn vị tổ chức không chỉ là tạo lịch sự kiện. Đó là trách nhiệm thiết kế toàn bộ trải nghiệm học tập và thi đấu:

- Xây dựng lộ trình để sinh viên biết mình cần học gì ở từng giai đoạn.
- Kết nối nội dung đào tạo với đầu ra của vòng thi.
- Tạo điều kiện để người học nhận được hướng dẫn và phản hồi từ mentor.
- Đưa tiêu chuẩn sản phẩm và kỳ vọng từ thị trường vào môi trường học tập.
- Duy trì mạch hành trình từ Kick-off, UniTour, Bootcamp đến Qualification Round và Demo Day.

UniHackFest cũng là bước tiếp theo trong định hướng dài hạn của Corelia: phát triển một thế hệ builder có khả năng kết nối **công nghệ, sản phẩm và thị trường**. Kỹ thuật là điều kiện cần, nhưng một đội ngũ chỉ tạo ra tác động khi hiểu người dùng, phối hợp hiệu quả và có thể đưa giải pháp đến gần với thực tế.

## 4. UniTour: Đưa Cơ Hội Đến Tận Giảng Đường

![Vì Sao Corelia Đồng Tổ Chức UniHackFest 2026?](/blog/vi-sao-corelia-dong-to-chuc-unihackfest-2026/IMG_3105_SnapseedCopy.jpg)

Hành trình UniHackFest UniTour chính thức khởi động tại **Đại học Kinh tế – Tài chính TP.HCM (UEF)**, đơn vị đồng tổ chức chương trình, vào ngày 15/06/2026. Sau điểm mở màn này, **Trường Đại học Hùng Vương TP.HCM (DHV)** trở thành điểm dừng UniTour thứ hai, tiếp tục đưa AI & Web3 đến gần hơn với sinh viên và giúp các bạn hình dung con đường từ người học đến builder.

UniTour có vai trò quan trọng vì không phải sinh viên nào cũng bắt đầu từ cùng một nền tảng. Có bạn đã từng viết Smart Contract; có bạn mạnh về thiết kế, kinh doanh hoặc truyền thông; cũng có bạn mới chỉ tò mò về một sản phẩm on-chain hoạt động như thế nào.

Thông qua các điểm dừng tại campus, chương trình muốn làm rõ rằng một đội Hackathon cần nhiều vai trò:

- **Developer** xây dựng nền tảng kỹ thuật và đưa sản phẩm lên môi trường hoạt động.
- **Designer** tạo nên trải nghiệm giúp người dùng hiểu và sử dụng sản phẩm.
- **Product/Business** nghiên cứu vấn đề, xác định thị trường và kết nối giải pháp với nhu cầu thực tế.

Sự đa dạng ấy giúp UniHackFest không trở thành sân chơi chỉ dành cho người đã biết blockchain. Đây là hành trình để sinh viên từ nhiều chuyên ngành tìm thấy vị trí của mình trong một đội ngũ phát triển sản phẩm.

## 5. Kết Nối Nhà Trường, Doanh Nghiệp Và Hệ Sinh Thái

![Vì Sao Corelia Đồng Tổ Chức UniHackFest 2026?](/blog/vi-sao-corelia-dong-to-chuc-unihackfest-2026/UEF01620.jpg)

Một chương trình liên trường chỉ tạo ra giá trị bền vững khi mỗi bên tham gia đều đóng góp đúng thế mạnh. Nhà trường mang đến môi trường học tập và sự thấu hiểu sinh viên. Đơn vị tổ chức thiết kế hành trình và vận hành trải nghiệm. Đối tác công nghệ, doanh nghiệp và mentor mang đến tiêu chuẩn thực tế, phản hồi chuyên môn và những cơ hội phát triển tiếp theo.

Tại UniHackFest 2026, **MEXC Ventures** và **Solana** đồng hành với vai trò nhà tài trợ. Hai track thi đấu phản ánh hai mặt quan trọng của một sản phẩm:

- **Product & Business Track** tập trung vào nghiên cứu thị trường, quy mô cơ hội và chiến lược tiếp cận thực tế.
- **Technical Build Track** tập trung vào sản phẩm on-chain trên Solana, khả năng vận hành trên Devnet, kết nối ví và giao dịch có thể kiểm chứng.

Việc đặt hai hướng tiếp cận trong cùng một hành trình truyền đi một thông điệp rõ ràng: sản phẩm công nghệ cần cả năng lực xây dựng lẫn sự thấu hiểu thị trường.

## 6. Thành Công Không Chỉ Được Đo Bằng Đội Vô Địch

![Vì Sao Corelia Đồng Tổ Chức UniHackFest 2026?](/blog/vi-sao-corelia-dong-to-chuc-unihackfest-2026/_DSC0755.jpg)

Giải thưởng tạo động lực và ghi nhận những đội ngũ nổi bật. Tuy nhiên, với vai trò đồng tổ chức, Corelia nhìn thành công của UniHackFest qua một tập hợp kết quả rộng hơn:

- Sinh viên có thể đi từ một vấn đề đến prototype có thể trình diễn.
- Các đội biết phân chia vai trò và phối hợp trong quá trình phát triển.
- Người học hiểu cách kiểm chứng sản phẩm thay vì chỉ mô tả ý tưởng.
- Mỗi cá nhân có thêm một đầu ra cụ thể cho portfolio.
- Nhà trường và doanh nghiệp nhìn thấy năng lực của sinh viên qua sản phẩm thực tế.
- Những đội tiềm năng có thể tiếp tục phát triển sau Demo Day.

Nếu sau 14 tuần, sinh viên hiểu rõ hơn mình muốn theo đuổi vai trò nào, biết cách bắt đầu một dự án và tự tin trình bày sản phẩm đã xây dựng, chương trình đã tạo ra giá trị vượt xa một bảng xếp hạng.

## 7. Từ Kick-off Đến Demo Day

Kick-off kiêm điểm UniTour đầu tiên tại UEF và điểm dừng thứ hai tại Trường Đại học Hùng Vương TP.HCM mới chỉ là những bước mở đầu. Phía trước là chuỗi hoạt động campus, giai đoạn Bootcamp Learning, Qualification Round và Demo Day: nơi các đội trình bày sản phẩm trước mentor, giám khảo và đối tác hệ sinh thái.

Corelia Academy sẽ tiếp tục đồng hành trong vai trò đơn vị tổ chức và đào tạo, giúp sinh viên giữ được mạch phát triển từ kiến thức đến sản phẩm. Chúng tôi tin rằng năng lực không được hình thành trong một khoảnh khắc “bùng nổ”, mà qua nhiều vòng học, làm, nhận phản hồi và cải tiến.

UniHackFest 2026 là lời mời dành cho những sinh viên muốn bước ra khỏi giới hạn của bài tập trên lớp và thử sức với một hành trình xây dựng thực sự.

**Tìm hiểu lộ trình và đăng ký tại [unihackfest.vn](https://unihackfest.vn/vi/?utm_source=corelia.academy&utm_medium=referral&utm_campaign=unihackfest_2026&utm_content=organizer_story_cta).**
$md$),
('vi', 'vietnam-rwa-summit-2026', 'vietnam-rwa-summit-2026', 'blog', 'published', $md$Vietnam RWA Summit 2026: Khi Tài Sản Thực Bước Vào Kỷ Nguyên Số$md$, $md$Vietnam RWA Summit 2026 lần đầu tại Hà Nội: diễn đàn chuyên sâu về Real World Assets, tokenization, chính sách và hạ tầng, do Vietnam Blockchain Association tổ chức, cuối tháng 6/2026.$md$, 'terran', 'announcements-events', ARRAY['web3','ecosystem','blockchain-fundamentals','smart-contracts','career-tips']::text[], '{"type":"image","src":"/blog/vietnam-rwa-summit-2026.png","alt":"Hình minh hoạ về tài sản thực (RWA) và tokenization tại Việt Nam","fit":"cover"}'::jsonb, '2026-04-27'::date, '2026-04-27'::timestamptz, '2026-04-27'::timestamptz, $md$**Tokenization**, mã hoá tài sản thực trên nền tảng blockchain, không còn là khái niệm của tương lai. Trên thế giới, hàng tỷ USD giá trị bất động sản, trái phiếu, vàng và các tài sản tài chính đang được số hoá mỗi ngày. Câu hỏi đặt ra không còn là liệu xu hướng này có xảy ra không, mà là **Việt Nam sẽ tham gia như thế nào và khi nào?**

Để trả lời câu hỏi đó, **Vietnam RWA Summit 2026 (VRS2026)** sẽ lần đầu tiên ra mắt tại Hà Nội vào **cuối tháng 6/2026**, diễn đàn chuyên sâu đầu tiên tại Việt Nam dành riêng cho lĩnh vực **Real World Assets**.

## RWA là gì và tại sao lại quan trọng?

**Real World Assets (RWA)** là các tài sản vật lý hoặc tài chính truyền thống, từ bất động sản, vàng, đến trái phiếu chính phủ, khoản vay doanh nghiệp, được biểu diễn dưới dạng token kỹ thuật số trên blockchain. Quá trình này cho phép:

- **Phân mảnh quyền sở hữu:** Một bất động sản trị giá hàng triệu đô có thể được chia nhỏ để hàng nghìn nhà đầu tư cùng tham gia.
- **Tăng tính thanh khoản:** Tài sản vốn kém thanh khoản như đất đai hay nghệ thuật có thể được giao dịch 24/7 trên thị trường toàn cầu.
- **Minh bạch và tự động hoá:** Hợp đồng thông minh thay thế nhiều lớp trung gian, giảm chi phí và rủi ro vận hành.

Theo các báo cáo từ BlackRock, Boston Consulting Group và nhiều tổ chức tài chính lớn, quy mô thị trường RWA toàn cầu có thể chạm mốc **16 nghìn tỷ USD** vào năm 2030.

## Việt Nam đứng ở đâu trong cuộc chuyển mình này?

Việt Nam sở hữu nhiều lợi thế tự nhiên để tham gia vào làn sóng RWA: nền kinh tế đang tăng trưởng nhanh, thị trường bất động sản sôi động, cộng đồng công nghệ năng động và tầng lớp nhà đầu tư trẻ am hiểu kỹ thuật số ngày càng lớn mạnh.

Tuy nhiên, thách thức không nhỏ: hành lang pháp lý cho tài sản số vẫn đang được định hình, hạ tầng kết nối tài sản thực với blockchain còn sơ khai, và nhận thức thị trường về RWA vẫn còn nhiều khoảng trống. Chính vì vậy, **một diễn đàn chuyên sâu**, nơi chính sách, công nghệ và thị trường cùng ngồi lại, là điều cần thiết hơn bao giờ hết.

## Vietnam RWA Summit 2026 sẽ là gì?

VRS2026 **không đơn thuần là một hội thảo**. Đây là không gian đối thoại được thiết kế cho những người thực sự xây dựng tương lai của tài chính Việt Nam:

- Các **nhà hoạch định chính sách** muốn hiểu sâu hơn về mô hình quản trị tài sản số phù hợp với đặc thù Việt Nam.
- Các **tổ chức tài chính và doanh nghiệp** đang tìm kiếm cơ hội ứng dụng tokenization trong hoạt động của mình.
- Các **công ty công nghệ và blockchain** đang phát triển hạ tầng cho thị trường RWA.
- Các **nhà đầu tư** muốn tiếp cận lớp tài sản mới này từ sớm.

Những câu hỏi cốt lõi sẽ được đặt ra và thảo luận tại sự kiện:

- Làm thế nào để **kết nối tài sản thực** với hạ tầng số một cách an toàn và hợp pháp?
- **Đâu là mô hình** phù hợp cho Việt Nam?
- **Ai sẽ là những người tiên phong?**

## Thông tin sự kiện

- **Địa điểm:** Hà Nội
- **Thời gian:** Cuối tháng 6/2026
- **Tổ chức:** Vietnam Blockchain Association (VBA)

Thông tin chi tiết về chương trình, diễn giả và đăng ký tham dự sẽ sớm được công bố.

## Đây là khoảnh khắc để Việt Nam đặt dấu ấn

Mỗi làn sóng công nghệ tài chính đều có những người đến sớm và những người theo sau. Với RWA, cửa sổ cơ hội đang mở, nhưng sẽ không mở mãi.

**Vietnam RWA Summit 2026** là lời mời gọi cho những ai muốn hiểu, muốn xây dựng và muốn dẫn đầu trong không gian này tại Việt Nam. Một hành trình mới sắp bắt đầu.

Theo dõi VBA để cập nhật thông tin sớm nhất về VRS2026. #VBA #VietnamRWASummit #RWA #VRS2026
$md$),
('vi', 'chua-co-team-van-tham-gia-unihackfest', 'join-unihackfest-without-a-team', 'blog', 'draft', $md$Chưa Có Team Vẫn Tham Gia Được: Cách Lập Đội Developer–Designer–Product$md$, $md$Hướng dẫn sinh viên tham gia UniHackFest khi chưa có đội, lựa chọn vai trò và xây dựng một team cân bằng để phát triển sản phẩm AI & Web3.$md$, NULL, 'announcements-events', ARRAY[]::text[], NULL, CURRENT_DATE, now(), now(), $md$Bạn muốn tham gia UniHackFest nhưng chưa có team? Đây không phải lý do để trì hoãn. Trong form đăng ký, tên đội là thông tin không bắt buộc. Bạn có thể đăng ký trước, xác định vai trò của mình và tìm những thành viên có kỹ năng bổ trợ trong quá trình tham gia cộng đồng, UniTour và các hoạt động học tập.

## Một Team Tốt Không Cần Ai Cũng Biết Mọi Thứ

Sai lầm phổ biến khi lập đội Hackathon là tìm những người có kỹ năng giống nhau hoặc chờ một thành viên “toàn năng”. Một đội sản phẩm hiệu quả cần sự bổ trợ.

### Developer

Developer chịu trách nhiệm hiện thực hóa sản phẩm: chương trình on-chain, frontend, tích hợp ví, dữ liệu và các luồng giao dịch. Team có thể chia thành smart contract/on-chain developer và frontend developer nếu đủ thành viên.

### Designer

Designer giúp sản phẩm trở nên dễ hiểu và dễ sử dụng. Vai trò này nghiên cứu hành vi người dùng, thiết kế luồng trải nghiệm, wireframe, giao diện và cách trình bày demo.

### Product/Business

Product/Business tập trung vào vấn đề, người dùng, thị trường, phạm vi MVP và câu chuyện pitching. Đây là người giúp team trả lời: chúng ta đang xây cho ai, vì sao họ cần nó và điều gì cần được kiểm chứng trước?

Một người có thể đảm nhiệm nhiều vai trò trong giai đoạn đầu, nhưng team nên thống nhất ai chịu trách nhiệm chính cho từng đầu ra.

## Bước 1: Viết “Hồ Sơ Đồng Đội” Của Chính Bạn

Trước khi tìm team, hãy trả lời bốn câu hỏi:

1. Kỹ năng mạnh nhất của bạn là gì?
2. Bạn có thể dành bao nhiêu thời gian mỗi tuần?
3. Bạn quan tâm vấn đề hoặc lĩnh vực nào?
4. Bạn muốn học thêm điều gì qua UniHackFest?

Một lời giới thiệu rõ ràng sẽ hiệu quả hơn câu “ai lập team với mình không?”.

## Bước 2: Tìm Kỹ Năng Còn Thiếu

Nếu bạn là Developer, đừng chỉ tìm thêm Developer. Hãy tìm người giúp team hiểu người dùng và trình bày sản phẩm. Nếu bạn mạnh Product, hãy tìm thành viên có khả năng biến ý tưởng thành prototype. Nếu bạn là Designer, hãy tìm team xem trải nghiệm người dùng là một phần của sản phẩm chứ không chỉ là khâu làm đẹp cuối cùng.

## Bước 3: Thử Làm Việc Cùng Nhau Trước Khi Chốt Team

Trước khi cam kết toàn bộ hành trình, hãy tổ chức một buổi làm việc ngắn:

- Chọn một vấn đề và thảo luận trong 30 phút.
- Thống nhất người dùng mục tiêu.
- Phác thảo một luồng sản phẩm đơn giản.
- Chia một nhiệm vụ nhỏ và hẹn thời gian kiểm tra lại.

Qua bài thử này, bạn sẽ thấy cách mỗi người giao tiếp, giữ cam kết và phản hồi ý kiến.

## Bước 4: Thống Nhất Cách Làm Việc

Team nên chốt sớm:

- Kênh giao tiếp chính.
- Lịch họp cố định.
- Người chịu trách nhiệm cho từng đầu ra.
- Cách đưa ra quyết định khi có bất đồng.
- Phạm vi MVP và danh sách tính năng chưa làm.

Một team rõ cách làm việc sẽ tiết kiệm nhiều thời gian hơn một team có ý tưởng lớn nhưng thiếu phối hợp.

## Những Dấu Hiệu Cảnh Báo

Hãy thận trọng nếu thành viên không thể cam kết thời gian tối thiểu, liên tục thay đổi mục tiêu mà không có lý do, chỉ quan tâm đến giải thưởng hoặc không muốn chia sẻ tiến độ. Trao đổi thẳng thắn từ đầu sẽ tốt hơn xử lý khủng hoảng gần deadline.

## Chưa Có Ý Tưởng Thì Sao?

Bạn không cần có ý tưởng hoàn chỉnh trước khi lập đội. Hãy bắt đầu bằng danh sách vấn đề thay vì danh sách công nghệ. Mỗi thành viên đưa ra ba điều mình quan sát thấy trong học tập, công việc hoặc cuộc sống. Sau đó nhóm các vấn đề tương tự và dùng Market Insight để kiểm chứng.

UniHackFest cung cấp lộ trình để đội phát triển ý tưởng qua Market Memo, AI Product MVP, Rust On-chain Lab, Solana dApp và Pitch Deck. Điều quan trọng là bắt đầu với một team sẵn sàng học và làm.

**[Đăng ký ngay cả khi chưa có team](https://unihackfest.vn/vi/?utm_source=unihackfest_articles&utm_medium=content&utm_campaign=unihackfest_2026&utm_content=team_formation_guide).**
$md$),
('en', 'join-unihackfest-without-a-team', 'join-unihackfest-without-a-team', 'blog', 'draft', $md$No Team Yet? How to Build a Developer–Designer–Product Team for UniHackFest$md$, $md$A practical guide for joining UniHackFest without an existing team, selecting a role, and forming a balanced group to build an AI and Web3 product.$md$, NULL, 'announcements-events', ARRAY[]::text[], NULL, CURRENT_DATE, now(), now(), $md$Want to join UniHackFest but do not have a team? That is not a reason to wait. The registration form treats the team name as optional. You can register first, identify your role, and meet people with complementary skills through the community, UniTour, and learning activities.

## Strong Teams Do Not Require Everyone to Know Everything

A common hackathon mistake is forming a team of people with identical skills or waiting for one person who can do everything. Effective product teams combine complementary roles.

- **Developers** implement on-chain programs, frontends, wallet integration, data, and transaction flows.
- **Designers** make the product understandable and usable through research, user flows, wireframes, interfaces, and demo presentation.
- **Product/Business contributors** focus on the problem, users, market, MVP scope, and pitch narrative.

One person may cover more than one role at the beginning, but the team should establish clear ownership for every output.

## Step 1: Write Your Own Teammate Profile

Before searching, answer four questions: What is your strongest skill? How much time can you commit each week? Which problems or sectors interest you? What do you want to learn through UniHackFest?

A specific introduction works better than simply asking whether anyone wants to form a team.

## Step 2: Search for Missing Skills

If you are a Developer, do not only recruit more Developers. Find someone who can understand users and communicate the product. If you are strong in Product, find people who can turn ideas into prototypes. If you are a Designer, look for a team that treats user experience as part of the product rather than final decoration.

## Step 3: Work Together Before Committing

Run a short trial session: select one problem, agree on a target user, sketch a simple product flow, assign one small task, and schedule a follow-up. This reveals how people communicate, honor commitments, and respond to feedback.

## Step 4: Agree on Ways of Working

Establish a primary communication channel, a recurring meeting time, ownership for each output, a decision process, and a clear MVP scope. A team with a shared working system will outperform a team with a large idea but weak coordination.

## Warning Signs

Be cautious when potential teammates cannot commit minimum time, repeatedly change direction without evidence, care only about prizes, or refuse to share progress. An honest conversation early is better than a crisis near the deadline.

## What If You Do Not Have an Idea?

Begin with problems rather than technology. Ask each member to bring three problems observed in study, work, or daily life. Group similar issues and use the Market Insight process to validate them.

UniHackFest helps teams develop ideas through a Market Memo, AI Product MVP, Rust On-chain Lab, Solana dApp, and Pitch Deck. The most important starting point is a team willing to learn and build together.

**[Register even if you do not have a team](https://unihackfest.vn/?utm_source=unihackfest_articles&utm_medium=content&utm_campaign=unihackfest_2026&utm_content=team_formation_guide).**
$md$),
('vi', 'lo-trinh-unihackfest-14-tuan', 'unihackfest-14-week-roadmap', 'blog', 'draft', $md$Lộ Trình UniHackFest 14 Tuần: Sinh Viên Cần Làm Gì Ở Từng Giai Đoạn?$md$, $md$Hướng dẫn toàn bộ lộ trình UniHackFest 2026 từ đăng ký, năm khóa học thực chiến và UniTour đến Qualification Round và Demo Day.$md$, NULL, 'announcements-events', ARRAY[]::text[], NULL, CURRENT_DATE, now(), now(), $md$UniHackFest không phải cuộc thi mà bạn chỉ xuất hiện vào cuối tuần, viết code thật nhanh rồi rời đi sau phần trao giải. Đây là hành trình 14 tuần giúp sinh viên đi từ **Market Insight đến Demo Day**, với kiến thức, đầu ra và cột mốc rõ ràng ở từng giai đoạn.

Nếu bạn đang cân nhắc tham gia nhưng chưa biết bắt đầu từ đâu, hướng dẫn này sẽ giúp bạn hình dung toàn bộ hành trình.

## Giai Đoạn 1: Đăng Ký Và Xác Định Vai Trò

Bạn có thể đăng ký bằng email sinh viên ngay cả khi chưa có đội. Hãy bắt đầu bằng việc chọn vai trò gần nhất với thế mạnh của mình:

- Developer nếu bạn muốn xây dựng chương trình, frontend hoặc tích hợp kỹ thuật.
- Designer nếu bạn quan tâm đến trải nghiệm và giao diện.
- Product/Business nếu bạn mạnh về nghiên cứu, chiến lược, người dùng hoặc pitching.

Sau khi đăng ký, hãy theo dõi email xác nhận và các cập nhật chính thức của chương trình.

## Giai Đoạn 2: Kick-off Và UniTour

Kick-off công bố chủ đề, thể lệ, timeline và các track. UniTour đưa chương trình đến campus để sinh viên tiếp cận Web3, Solana, AI product thinking và đặt câu hỏi trực tiếp với ban tổ chức hoặc chuyên gia.

Đầu ra quan trọng nhất ở giai đoạn này là hiểu chương trình, chọn hướng tham gia và bắt đầu kết nối với những người có kỹ năng bổ trợ.

## Giai Đoạn 3: Năm Khóa Học Thực Chiến

### C1 – Market Insight

Đội thi nghiên cứu vấn đề, người dùng, thị trường và cơ hội. Đầu ra là **Market Memo**, giúp chứng minh đội không xây sản phẩm dựa trên phỏng đoán đơn thuần.

### C2 – AI Product Building

Các đội chuyển insight thành **AI Product MVP**, xác định tính năng cốt lõi và giả định cần kiểm chứng trước.

### C3 – Rust Survival Kit

Người học xây nền tảng Rust cần thiết thông qua **Rust On-chain Lab**. Mục tiêu không phải học toàn bộ ngôn ngữ, mà nắm những phần cần dùng để bước vào phát triển on-chain.

### C4 – Solana Bootcamp

Đội thi xây **Solana dApp trên Devnet**, kết nối ví, giao diện và giao dịch có bằng chứng trên Explorer.

### C5 – Pitching

Các đội hoàn thiện **Pitch Deck và Demo**, làm rõ vấn đề, giải pháp, sản phẩm, thị trường và kế hoạch tiếp theo.

## Giai Đoạn 4: Chọn Track

**Product & Business Track** phù hợp với đội mạnh về nghiên cứu thị trường tài sản số, market sizing và go-to-market Việt Nam/Đông Nam Á.

**Technical Build Track** phù hợp với đội tập trung xây sản phẩm on-chain trên Solana, có chương trình hoạt động trên Devnet, tích hợp ví và giao dịch kiểm chứng được.

Việc chọn track không có nghĩa bỏ qua phần còn lại. Đội kỹ thuật vẫn cần hiểu người dùng; đội sản phẩm vẫn cần có MVP đủ rõ ràng để chứng minh giải pháp.

## Giai Đoạn 5: Qualification Round

Trước vòng loại, hãy kiểm tra:

- Vấn đề và người dùng mục tiêu có được mô tả rõ không?
- Prototype có thể demo theo một luồng hoàn chỉnh không?
- Các tuyên bố kỹ thuật có bằng chứng kiểm chứng không?
- Vai trò từng thành viên và phần đóng góp có rõ không?
- Pitch có tập trung vào giá trị thay vì liệt kê tính năng không?

Các đội hoàn thiện prototype và pitching để cạnh tranh suất vào Final.

## Giai Đoạn 6: Demo Day

Demo Day là thời điểm các đội finalist trình bày sản phẩm trước mentor, giám khảo và đối tác hệ sinh thái. Đây không chỉ là ngày trao giải mà còn là cơ hội kết nối, nhận phản hồi và mở ra hướng incubation hoặc hợp tác tiếp theo.

## Bạn Nên Bắt Đầu Ngay Hôm Nay Như Thế Nào?

1. Đăng ký bằng email sinh viên.
2. Chọn vai trò chính.
3. Tìm hai hoặc ba người có kỹ năng bổ trợ.
4. Liệt kê ba vấn đề bạn thực sự quan tâm.
5. Bắt đầu khóa học và tạo đầu ra đầu tiên.

Không cần chờ đến khi có ý tưởng hoàn hảo. UniHackFest được thiết kế để giúp bạn phát triển ý tưởng qua quá trình học, làm và nhận phản hồi.

**[Đăng ký UniHackFest 2026](https://unihackfest.vn/vi/?utm_source=unihackfest_articles&utm_medium=content&utm_campaign=unihackfest_2026&utm_content=roadmap_guide).**
$md$),
('en', 'unihackfest-14-week-roadmap', 'unihackfest-14-week-roadmap', 'blog', 'draft', $md$The UniHackFest 14-Week Roadmap: What Students Need to Do at Every Stage$md$, $md$A complete guide to UniHackFest 2026, from registration and five hands-on courses to the Qualification Round and Demo Day.$md$, NULL, 'announcements-events', ARRAY[]::text[], NULL, CURRENT_DATE, now(), now(), $md$UniHackFest is not a competition where you arrive for one weekend, code as quickly as possible, and leave after the awards ceremony. It is a 14-week journey from **Market Insight to Demo Day**, with clear learning content, outputs, and milestones at every stage.

## Stage 1: Register and Choose a Role

Students can register with their university email even without an existing team. Begin by selecting the role closest to your strengths: Developer, Designer, or Product/Business. Check your inbox for confirmation and official program updates.

## Stage 2: Kick-off and UniTour

The Kick-off announces themes, rules, tracks, and the timeline. UniTour brings Web3, Solana, AI product thinking, and direct Q&A to university campuses. Your goal is to understand the journey, choose a direction, and begin meeting people with complementary skills.

## Stage 3: Complete Five Hands-on Courses

- **C1 Market Insight:** Research the problem, users, and opportunity; produce a Market Memo.
- **C2 AI Product Building:** Turn insight into a focused AI Product MVP.
- **C3 Rust Survival Kit:** Build the necessary foundation through a Rust On-chain Lab.
- **C4 Solana Bootcamp:** Develop a Solana dApp on Devnet with wallet integration and Explorer proof.
- **C5 Pitching:** Complete a Pitch Deck and product Demo.

## Stage 4: Choose a Track

The **Product & Business Track** emphasizes digital asset market research, market sizing, and Vietnam or Southeast Asia go-to-market strategy.

The **Technical Build Track** emphasizes an on-chain product on Solana, functional Devnet deployment, wallet integration, frontend setup, and verifiable transactions.

Track selection sets the emphasis, but strong teams still connect technology, users, and market context.

## Stage 5: Prepare for the Qualification Round

Before submitting, confirm that the problem and target users are clear, the prototype supports a complete demo flow, technical claims have verifiable proof, team contributions are clear, and the pitch communicates value rather than listing features.

## Stage 6: Reach Demo Day

Finalists present to mentors, judges, and ecosystem partners. Demo Day is both a competition milestone and an opportunity for feedback, networking, and potential incubation or collaboration.

## What Should You Do Today?

1. Register with your student email.
2. Choose your primary role.
3. Find teammates with complementary skills.
4. List three problems you genuinely care about.
5. Begin the learning path and produce your first output.

You do not need a perfect idea before starting. UniHackFest is designed to improve ideas through learning, building, feedback, and iteration.

**[Register for UniHackFest 2026](https://unihackfest.vn/?utm_source=unihackfest_articles&utm_medium=content&utm_campaign=unihackfest_2026&utm_content=roadmap_guide).**
$md$),
('vi', 'unihackfest-2026-chinh-thuc-khoi-dong-tai-uef', 'unihackfest-2026-official-kickoff-at-uef', 'blog', 'draft', $md$UniHackFest 2026 Chính Thức Khởi Động Tại UEF: Hành Trình 14 Tuần Bắt Đầu$md$, $md$UniHackFest 2026 chính thức khởi động tại UEF, mở ra hành trình 14 tuần giúp sinh viên học, xây dựng và pitching sản phẩm AI & Web3 thực tế.$md$, NULL, 'announcements-events', ARRAY[]::text[], NULL, '2026-06-15'::date, now(), now(), $md$UniHackFest 2026 đã chính thức khởi động tại **Đại học Kinh tế – Tài chính TP.HCM (UEF)**, mở ra hành trình 14 tuần dành cho sinh viên muốn đi từ một vấn đề thực tế đến sản phẩm AI & Web3 có thể demo và pitching.

Buổi Kick-off không chỉ đánh dấu thời điểm chương trình bắt đầu. Đây còn là dịp để sinh viên nhìn thấy toàn bộ con đường phía trước: học kiến thức nền tảng, hình thành đội ngũ, nghiên cứu thị trường, xây dựng MVP, phát triển sản phẩm on-chain và bước lên sân khấu Demo Day.

**[BỔ SUNG: Số người tham dự, khoa/ngành hoặc các trường tham gia]** đã có mặt tại chương trình. Không khí tại sự kiện cho thấy sinh viên không chỉ tò mò về công nghệ mới mà còn sẵn sàng trực tiếp xây dựng sản phẩm và thử sức trong môi trường thực chiến.

<!-- IMAGE_SLOT: Thay comment này bằng: ![Toàn cảnh hội trường Kick-off UniHackFest tại UEF](/images/blog/TEN-ANH.jpg) -->

## UniHackFest Không Chỉ Là Một Cuộc Thi

Điểm khác biệt của UniHackFest nằm ở mô hình **“học trước – thi sau”**. Thay vì yêu cầu sinh viên lập tức bước vào Hackathon với một ý tưởng chưa được kiểm chứng, chương trình trang bị lộ trình học tập và đầu ra cụ thể cho từng giai đoạn.

Trong 14 tuần, các đội sẽ đi qua năm nội dung thực chiến:

- **Market Insight:** Hiểu người dùng, vấn đề và cơ hội thị trường.
- **AI Product Building:** Chuyển insight thành sản phẩm tối thiểu có thể thử nghiệm.
- **Rust Survival Kit:** Xây dựng nền tảng kỹ thuật cần thiết trước khi phát triển on-chain.
- **Solana Bootcamp:** Phát triển dApp trên Solana Devnet, kết nối ví và tạo giao dịch có thể kiểm chứng.
- **Pitching:** Hoàn thiện câu chuyện sản phẩm, pitch deck và phần demo.

Mỗi khóa học tạo ra một đầu ra nối tiếp nhau: từ Market Memo, AI Product MVP đến Rust On-chain Lab, Solana dApp Devnet và Pitch Deck hoàn chỉnh. Nhờ đó, sinh viên không học những phần kiến thức rời rạc mà từng bước tạo nên một sản phẩm có thể trình diễn.

## Hai Track, Hai Góc Nhìn Của Một Sản Phẩm Tốt

Tại Kick-off, sinh viên được giới thiệu hai hướng thi đấu chính của UniHackFest 2026:

### Product & Business Track – MEXC Ventures

Track dành cho những đội muốn đi sâu vào nghiên cứu thị trường tài sản số, quy mô cơ hội và chiến lược tiếp cận người dùng tại Việt Nam hoặc Đông Nam Á. Đây là nơi khả năng thấu hiểu thị trường và tư duy sản phẩm được đặt lên hàng đầu.

### Technical Build Track – Solana

Track tập trung vào sản phẩm on-chain trên Solana. Đội thi cần phát triển chương trình hoạt động trên Devnet, tích hợp ví và giao diện, đồng thời cung cấp giao dịch có thể kiểm chứng trên Explorer.

Hai track thể hiện rõ tinh thần của chương trình: một sản phẩm có giá trị cần cả năng lực xây dựng công nghệ lẫn hiểu biết về người dùng và thị trường.

## Những Chia Sẻ Từ Chuyên Gia

Buổi Kick-off có sự tham gia của ba diễn giả đến từ các đối tác hệ sinh thái quốc tế: **Ms. Jenny Nguyễn – đại diện MEXC Ventures; Mr. Cris D. Tran – đại diện Open Campus; và Mr. Phạm Minh Tuấn – đại diện Solana Foundation**.

Các phiên chia sẻ tập trung vào **Digital Asset Market & Opportunities for Student Builders; Edu Chain & Digital Credentials for Future Talent; Building on Solana: Why Now, Why Vietnam** cùng tổng quan learning track và timeline 14 tuần của UniHackFest. Thông qua những góc nhìn từ nhà trường, doanh nghiệp và hệ sinh thái, sinh viên có cơ hội hiểu rõ hơn về cách một ý tưởng được chuyển thành sản phẩm và những năng lực cần chuẩn bị để đi đường dài trong AI & Web3.

> “[BỔ SUNG TRÍCH DẪN ĐÃ ĐƯỢC XÁC NHẬN]” — **[TÊN NGƯỜI PHÁT BIỂU]**

<!-- IMAGE_SLOT: Thay comment này bằng: ![Diễn giả chia sẻ tại Kick-off UniHackFest](/images/blog/TEN-ANH.jpg) -->

## Từ Kick-off Đến 15 Điểm Dừng UniTour

Sau sự kiện mở màn tại UEF, UniHackFest tiếp tục hành trình đến các campus thông qua chuỗi UniTour. Các workshop giúp sinh viên tiếp cận trực tiếp với AI, Web3, Solana và tư duy sản phẩm; đồng thời giải đáp những câu hỏi thực tế về cách tham gia, lập đội và lựa chọn track.

UniTour cũng mở ra cơ hội cho sinh viên từ nhiều chuyên ngành tìm thấy vai trò phù hợp. Một đội có thể gồm Developer, Designer và Product/Business. Bạn không cần biết mọi thứ trước khi bắt đầu; điều quan trọng là sẵn sàng học, làm việc cùng đồng đội và liên tục cải thiện sản phẩm.

## Hành Trình 14 Tuần Đã Bắt Đầu

Kick-off tại UEF đã đặt viên gạch đầu tiên cho một hành trình dài hơn. Phía trước là UniTour, Bootcamp Learning, Qualification Round và Demo Day — nơi các đội đưa sản phẩm đến trước mentor, giám khảo và đối tác hệ sinh thái.

UniHackFest 2026 được đồng tổ chức bởi **Corelia Academy và UEF**, với sự tài trợ của **MEXC Ventures và Solana**, cùng sự đồng hành của các đối tác và chuyên gia trong hệ sinh thái.

Nếu bạn muốn biến một ý tưởng thành sản phẩm AI & Web3 có thể demo, đây là lúc bắt đầu.

**[Đăng ký tham gia UniHackFest 2026](https://unihackfest.vn/vi/?utm_source=unihackfest_articles&utm_medium=content&utm_campaign=unihackfest_2026&utm_content=kickoff_uef_recap).**

<!-- IMAGE_SLOT: Thay comment này bằng: ![Sinh viên, ban tổ chức và diễn giả tại Kick-off UniHackFest](/images/blog/TEN-ANH.jpg) -->
$md$),
('en', 'unihackfest-2026-official-kickoff-at-uef', 'unihackfest-2026-official-kickoff-at-uef', 'blog', 'draft', $md$UniHackFest 2026 Officially Kicks Off at UEF: The 14-Week Journey Begins$md$, $md$UniHackFest 2026 officially kicked off at UEF, opening a 14-week journey in which students learn, build, and pitch real AI and Web3 products.$md$, NULL, 'announcements-events', ARRAY[]::text[], NULL, '2026-06-15'::date, now(), now(), $md$UniHackFest 2026 officially kicked off at the **University of Economics and Finance, Ho Chi Minh City (UEF)**, opening a 14-week journey for students ready to move from a real-world problem to an AI and Web3 product they can demonstrate and pitch.

The Kick-off marked more than the beginning of a competition. It gave students a complete view of the road ahead: build foundations, form teams, research a market, create an MVP, develop an on-chain product, and ultimately step onto the Demo Day stage.

**[ADD: Confirmed attendance and participating faculties or universities]** joined the opening event. The energy in the room reflected more than curiosity about emerging technology; it showed a willingness to build products and learn through real execution.

<!-- IMAGE_SLOT: Replace this comment with: ![UniHackFest Kick-off audience at UEF](/images/blog/IMAGE-NAME.jpg) -->

## More Than a Competition

UniHackFest follows a **learn-before-you-compete** model. Instead of asking students to enter a hackathon immediately with an unvalidated idea, the program provides a structured learning path and a tangible output at every stage.

Across 14 weeks, teams progress through Market Insight, AI Product Building, Rust Survival Kit, Solana Bootcamp, and Pitching. Together, these learning areas produce a Market Memo, AI Product MVP, Rust On-chain Lab, Solana dApp on Devnet, and a complete Pitch Deck and Demo.

## Two Tracks, Two Sides of a Strong Product

The Kick-off introduced two principal competition tracks:

- The **MEXC Ventures Product & Business Track** emphasizes digital asset market research, opportunity sizing, and a practical Vietnam or Southeast Asia go-to-market strategy.
- The **Solana Technical Build Track** emphasizes a functional on-chain product on Solana Devnet, wallet and frontend integration, and verifiable Explorer transactions.

Together, the tracks reinforce a core program principle: meaningful technology products require both execution and market understanding.

## Insights from Industry Experts

The Kick-off featured three speakers from international ecosystem partners: **Ms. Jenny Nguyen representing MEXC Ventures, Mr. Cris D. Tran representing Open Campus, and Mr. Pham Minh Tuan representing Solana Foundation**. Sessions covered **Digital Asset Market & Opportunities for Student Builders; Edu Chain & Digital Credentials for Future Talent; Building on Solana: Why Now, Why Vietnam**, as well as the UniHackFest learning tracks and 14-week timeline.

> “[ADD A VERIFIED QUOTE]” — **[SPEAKER NAME]**

<!-- IMAGE_SLOT: Replace this comment with: ![A speaker presenting at the UniHackFest Kick-off](/images/blog/IMAGE-NAME.jpg) -->

## From Kick-off to 15 UniTour Campuses

Following the opening event at UEF, UniHackFest continues through a UniTour series across university campuses. These workshops bring AI, Web3, Solana, and product thinking closer to students while answering practical questions about registration, team formation, and track selection.

Students from different disciplines can contribute as Developers, Designers, or Product/Business members. Participants do not need to know everything before they begin; they need a willingness to learn, collaborate, and improve their product over time.

## The 14-Week Journey Has Begun

The UEF Kick-off laid the first foundation for UniTour, Bootcamp Learning, the Qualification Round, and Demo Day. UniHackFest 2026 is co-organized by **Corelia Academy and UEF**, sponsored by **MEXC Ventures and Solana**, and supported by ecosystem partners and experts.

If you are ready to turn an idea into a demonstrable AI and Web3 product, this is your starting point.

**[Register for UniHackFest 2026](https://unihackfest.vn/?utm_source=unihackfest_articles&utm_medium=content&utm_campaign=unihackfest_2026&utm_content=kickoff_uef_recap).**

<!-- IMAGE_SLOT: Replace this comment with: ![Students, organizers, and speakers at the UniHackFest Kick-off](/images/blog/IMAGE-NAME.jpg) -->
$md$),
('vi', 'unitour-2-dai-hoc-hung-vuong-tphcm', 'unitour-2-hung-vuong-university-hcmc', 'blog', 'draft', $md$UniTour #2 Tại Đại Học Hùng Vương TP.HCM: Từ Web3 Growth Hacking Đến Hành Trình Builder Trên Solana$md$, $md$UniTour #2 của UniHackFest 2026 tại Trường Đại học Hùng Vương TP.HCM mang đến các góc nhìn về Web3 Growth Hacking, giáo dục Web3 và hành trình xây dựng bền vững trên Solana.$md$, NULL, 'announcements-events', ARRAY[]::text[], NULL, '2026-06-18'::date, now(), now(), $md$Sau Kick-off và điểm UniTour đầu tiên tại UEF, hành trình UniHackFest 2026 đã đến với **Trường Đại học Hùng Vương TP.HCM (DHV)** trong điểm dừng UniTour thứ hai vào ngày **18/06/2026**. Chương trình đưa AI, Web3, Solana và tư duy phát triển sản phẩm đến gần hơn với sinh viên, đồng thời mở ra một con đường rõ ràng từ người mới bắt đầu đến một builder có sản phẩm thực tế.

**[BỔ SUNG SỐ NGƯỜI THAM DỰ]** sinh viên từ **[BỔ SUNG KHOA/NGÀNH]** đã tham gia workshop. Thay vì chỉ giới thiệu thuật ngữ, UniTour tập trung giúp người học hiểu mình sẽ làm gì trong hành trình 14 tuần và vai trò nào phù hợp với thế mạnh cá nhân.

<!-- IMAGE_SLOT: Thay comment này bằng: ![Toàn cảnh UniTour tại Trường Đại học Hùng Vương TP.HCM](/images/blog/TEN-ANH.jpg) -->

## AI & Web3 Không Chỉ Dành Cho Developer

Một trong những rào cản phổ biến khi sinh viên nghe đến Hackathon Web3 là suy nghĩ rằng chỉ người giỏi lập trình mới có thể tham gia. UniTour #2 đã mở rộng bức tranh ấy.

Một đội sản phẩm cần nhiều năng lực bổ trợ:

- **Developer** xây dựng chương trình on-chain, giao diện và các luồng tương tác kỹ thuật.
- **Designer** tổ chức trải nghiệm để sản phẩm trở nên dễ hiểu và dễ sử dụng.
- **Product/Business** nghiên cứu vấn đề, xác định thị trường và xây dựng cách tiếp cận người dùng.

Sự kết hợp giữa các vai trò giúp đội thi đi xa hơn một bản demo kỹ thuật. Mục tiêu là tạo nên sản phẩm giải quyết được vấn đề, có trải nghiệm rõ ràng và có thể thuyết phục người khác về giá trị của nó.

## Ba Góc Nhìn Từ Nội Dung, Giáo Dục Đến Solana

Tại workshop, sinh viên được lắng nghe ba phần chia sẻ:

- **Ms. Jenny Nguyen – MEXC Ventures:** “Web3 Growth Hacking – Breakthrough Content Creation for Gen Z”.
- **Mr. Cris D. Tran – Open Campus:** “Open Campus: Education & Innovation in Web3”.
- **Mr. Le Quang Dat – Solana Builder, Superteam APAC Contributor:** “From Zero to Sustainable: A Builder’s Journey on Solana”.

Sinh viên được giới thiệu lộ trình năm phần của UniHackFest:

1. Hiểu thị trường và viết Market Memo.
2. Biến insight thành AI Product MVP.
3. Xây nền tảng Rust thông qua On-chain Lab.
4. Phát triển dApp trên Solana Devnet.
5. Hoàn thiện Pitch Deck và phần demo.

Cách tiếp cận “học trước – thi sau” giúp người mới không bị bỏ lại phía sau. Mỗi giai đoạn đều có nội dung, đầu ra và cột mốc để đội thi biết mình cần hoàn thành điều gì trước khi bước tiếp.

## Những Câu Hỏi Từ Sinh Viên Đại Học Hùng Vương TP.HCM

Phiên trao đổi tại UniTour ghi nhận nhiều câu hỏi xoay quanh **[BỔ SUNG CÁC CÂU HỎI THỰC TẾ: chưa có đội, chưa biết Rust, cách chọn track, thời gian học...]**.

Đây cũng là những băn khoăn phổ biến của người mới. UniHackFest cho phép sinh viên đăng ký ngay cả khi chưa có team; tên đội là thông tin không bắt buộc trong form. Người học có thể bắt đầu bằng vai trò mình tự tin nhất, sau đó bổ sung thành viên có kỹ năng phù hợp.

> “[BỔ SUNG TRÍCH DẪN SINH VIÊN HOẶC ĐẠI DIỆN NHÀ TRƯỜNG]” — **[TÊN, LỚP/CHỨC DANH]**

<!-- IMAGE_SLOT: Thay comment này bằng: ![Sinh viên DHV trao đổi với diễn giả tại UniTour](/images/blog/TEN-ANH.jpg) -->

## Một Điểm Dừng, Nhiều Bước Đi Tiếp Theo

UniTour #2 không phải một buổi truyền cảm hứng đứng riêng lẻ. Đây là cửa vào hành trình Bootcamp, Qualification Round và Demo Day. Sau workshop, sinh viên có thể đăng ký chương trình, chọn vai trò, hình thành đội và bắt đầu các nội dung học tập.

UniHackFest 2026 được đồng tổ chức bởi **Corelia Academy và UEF**, với sự tài trợ của **MEXC Ventures và Solana**. Chương trình hướng đến việc giúp sinh viên tạo ra đầu ra thật: nghiên cứu thị trường, MVP, sản phẩm on-chain và phần pitching hoàn chỉnh.

Trường Đại học Hùng Vương TP.HCM là điểm dừng thứ hai của chuỗi UniTour. Những campus tiếp theo sẽ tiếp tục kết nối thêm nhiều builder trẻ trên toàn quốc.

**[Đăng ký UniHackFest 2026](https://unihackfest.vn/vi/?utm_source=unihackfest_articles&utm_medium=content&utm_campaign=unihackfest_2026&utm_content=unitour_dhv_recap).**

<!-- IMAGE_SLOT: Thay comment này bằng: ![Sinh viên Đại học Hùng Vương TP.HCM và ban tổ chức UniTour](/images/blog/TEN-ANH.jpg) -->
$md$),
('en', 'unitour-2-hung-vuong-university-hcmc', 'unitour-2-hung-vuong-university-hcmc', 'blog', 'draft', $md$UniTour #2 at Hung Vuong University HCMC: From Web3 Growth Hacking to Building Sustainably on Solana$md$, $md$UniHackFest 2026's second UniTour stop at Hung Vuong University HCMC explored Web3 Growth Hacking, education and innovation in Web3, and the journey to sustainable building on Solana.$md$, NULL, 'announcements-events', ARRAY[]::text[], NULL, '2026-06-18'::date, now(), now(), $md$Following the Kick-off and opening UniTour stop at UEF, the UniHackFest 2026 journey arrived at **Hung Vuong University, Ho Chi Minh City (DHV)** for its second UniTour stop on **June 18, 2026**. The workshop brought AI, Web3, Solana, and product development closer to students while showing a clear path from beginner to builder with a real product.

**[ADD CONFIRMED ATTENDANCE]** students from **[ADD FACULTIES OR MAJORS]** joined the workshop. Instead of presenting terminology alone, UniTour focused on what participants would do during the 14-week journey and which roles could match their strengths.

<!-- IMAGE_SLOT: Replace this comment with: ![UniTour audience at Hung Vuong University HCMC](/images/blog/IMAGE-NAME.jpg) -->

## AI and Web3 Need More Than Developers

A common barrier for students is the belief that a Web3 hackathon is only for experienced programmers. UniTour #1 broadened that picture by introducing the complementary roles of Developers, Designers, and Product/Business contributors.

Together, these capabilities help a team move beyond a technical demonstration toward a product that addresses a problem, creates a clear user experience, and communicates meaningful value.

## Three Perspectives across Content, Education, and Solana

The workshop featured three sessions:

- **Ms. Jenny Nguyen – MEXC Ventures:** “Web3 Growth Hacking – Breakthrough Content Creation for Gen Z”.
- **Mr. Cris D. Tran – Open Campus:** “Open Campus: Education & Innovation in Web3”.
- **Mr. Le Quang Dat – Solana Builder, Superteam APAC Contributor:** “From Zero to Sustainable: A Builder’s Journey on Solana”.

Students explored UniHackFest's five-part roadmap: Market Memo, AI Product MVP, Rust On-chain Lab, Solana dApp on Devnet, and Pitch Deck plus Demo. The learn-before-you-compete model gives beginners clear outputs and milestones before the competition stages.

## Questions from Hung Vuong University HCMC Students

The discussion included questions about **[ADD REAL QUESTIONS: joining without a team, learning Rust, selecting a track, time commitment...]**.

Students can register even if they do not yet have a team; the registration form treats the team name as optional. Participants can begin with their strongest role and then find teammates with complementary skills.

> “[ADD A VERIFIED STUDENT OR UNIVERSITY QUOTE]” — **[NAME AND ROLE/CLASS]**

<!-- IMAGE_SLOT: Replace this comment with: ![DHV students speaking with UniTour presenters](/images/blog/IMAGE-NAME.jpg) -->

## One Campus Stop, Many Next Steps

UniTour #2 is not an isolated inspiration session. It is an entry point into Bootcamp Learning, the Qualification Round, and Demo Day. After the workshop, students can register, select a role, form a team, and begin the learning content.

UniHackFest 2026 is co-organized by **Corelia Academy and UEF**, sponsored by **MEXC Ventures and Solana**, and designed to help students produce tangible outputs across market research, MVP development, on-chain building, and pitching.

Hung Vuong University, Ho Chi Minh City was the second stop in the UniTour series. Future campus stops will continue connecting emerging talent across Vietnam.

**[Register for UniHackFest 2026](https://unihackfest.vn/?utm_source=unihackfest_articles&utm_medium=content&utm_campaign=unihackfest_2026&utm_content=unitour_dhv_recap).**

<!-- IMAGE_SLOT: Replace this comment with: ![Hung Vuong University HCMC students and UniTour organizers](/images/blog/IMAGE-NAME.jpg) -->
$md$)
ON CONFLICT DO NOTHING;
