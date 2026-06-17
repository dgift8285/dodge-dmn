const PREFIX = process.env.PREFIX || '.';
const BRANDFETCH_KEY = process.env.BRANDFETCH_KEY;

export const toolsCommands = {
  brand: {
    names: ['brand'],
    execute: async (sock, msg, args) => {
      const jid = msg.key.remoteJid;

      if (!BRANDFETCH_KEY) {
        await sock.sendMessage(jid, { text: '❌ BRANDFETCH_KEY not set in environment variables.' });
        return;
      }

      const domain = args[0]?.toLowerCase().trim();
      if (!domain) {
        await sock.sendMessage(jid, { text: `Usage: ${PREFIX}brand <domain>\nExample: ${PREFIX}brand apple.com` });
        return;
      }

      await sock.sendMessage(jid, { text: `🔍 Looking up *${domain}*...` });

      try {
        const url = `https://api.brandfetch.io/v2/brands/${encodeURIComponent(domain)}`;
        const response = await fetch(url, {
          method: 'GET',
          headers: { Authorization: `Bearer ${BRANDFETCH_KEY}` }
        });

        if (!response.ok) {
          await sock.sendMessage(jid, { text: `❌ Brand not found for *${domain}*. Make sure it's a valid domain.` });
          return;
        }

        const data = await response.json();

        // Name & description
        const name = data.name || domain;
        const description = data.description || 'No description available.';
        const domain_ = data.domain || domain;

        // Colors
        let colorsText = '';
        const colors = data.colors?.slice(0, 4) || [];
        if (colors.length > 0) {
          colorsText = '\n\n🎨 *Brand Colors*\n' + colors.map(c => `▪️ ${c.hex}`).join('\n');
        }

        // Socials
        let socialsText = '';
        const socials = data.links?.filter(l => l.url) || [];
        if (socials.length > 0) {
          socialsText = '\n\n🔗 *Socials*\n' + socials.slice(0, 5).map(l => `▪️ ${l.name}: ${l.url}`).join('\n');
        }

        // Industry
        let industryText = '';
        const industry = data.company?.industries?.[0]?.emoji
          ? `${data.company.industries[0].emoji} ${data.company.industries[0].name}`
          : data.company?.industries?.[0]?.name || null;
        if (industry) industryText = `\n\n🏭 *Industry*: ${industry}`;

        // Logo
        const logo = data.logos?.[0]?.formats?.[0]?.src || null;

        const text = `🏢 *${name}*
🌐 ${domain_}
📝 ${description}${colorsText}${socialsText}${industryText}`.trim();

        if (logo) {
          try {
            await sock.sendMessage(jid, {
              image: { url: logo },
              caption: text
            });
            return;
          } catch {
            // logo failed, fall through to text
          }
        }

        await sock.sendMessage(jid, { text });

      } catch (err) {
        console.error('Brand lookup error:', err.message);
        await sock.sendMessage(jid, { text: `❌ Failed to fetch brand info for *${domain}*.` });
      }
    }
  }
};
