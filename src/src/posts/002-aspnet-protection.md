---
layout: post.hbs
title: ASP.NET XSS protection
keywords: asp.net,xss,config
date: 2017-09-06
desc: Securing an ASP.NET WebApi for PCI application tests is no trivial matter.  It can take weeks of planning and the app to be analyzed.  After reviewing OWASP and other related XSS sites, the web.config was the first to be updated to prevent against attacks (MIIM & XSS).
image: ../../images/SSL-Featured.png
imageAlt: ASP.Net XSS protection
priority: 0.9
---

Securing an ASP.NET WebApi for PCI application tests is no trivial matter.  It can take weeks of planning and the app to be analyzed.  After reviewing OWASP and other related XSS sites, the web.config was the first to be updated to prevent against attacks (MIIM & XSS).


In &lt;system.webServer&gt;, add the following.
<pre>
&lt;httpProtocol&gt;
      &lt;customHeaders&gt;
        &lt;remove name="Server" /&gt;
        &lt;remove name="X-Powered-By" /&gt;
        &lt;remove name="X-Frame-Options" /&gt;
        &lt;remove name="X-XSS-Protection" /&gt;
        &lt;remove name="X-Content-Type-Options" /&gt;
        &lt;remove name="Cache-Control" /&gt;
        &lt;remove name="Pragma" /&gt;
        &lt;remove name="Expires" /&gt;
        &lt;remove name="Content-Security-Policy" /&gt;
        &lt;clear /&gt; &lt;!-- removing anything set by IIS --&gt;
        &lt;add name="X-Frame-Options" value="DENY" /&gt;
        &lt;add name="X-XSS-Protection" value="1; mode=block" /&gt;
        &lt;add name="X-Content-Type-Options" value="nosniff" /&gt;
        &lt;add name="Cache-Control" value="no-cache, no-store, must-revalidate" /&gt; &lt;!-- cache could be altered --&gt;
        &lt;add name="Pragma" value="no-cache" /&gt; &lt;!-- cache could be altered --&gt;
        &lt;add name="Expires" value="Sun, 1 Jan 1990 00:00:00 UTC" /&gt; &lt;!-- cache could be altered so set far in past and not -1 --&gt;
        &lt;add name="Content-Security-Policy" value="default-src 'self' 'unsafe-inline' data; font-src *; img-src https://*;" /&gt; &lt;!-- where resources can come from --&gt;
      &lt;/customHeaders&gt;
    &lt;/httpProtocol&gt;
</pre>


[Content security policy](https://developer.mozilla.org/en-US/docs/Web/HTTP/CSP) was the only one considered less secure due to outside javascript & CSS resources the app used (Google Analytics, Bootstrap, etc).

## Additional Protection

*   Applying AntiXss attribute from the [ASP.Net Web API AntiXss Attribute](https://bitbucket.org/embarr-development/asp.net-web-api-antixss-attribute) project. Check it out here: https://bitbucket.org/embarr-development/asp.net-web-api-antixss-attribute
*   Use a Website Application Firewall for your apps.
    *   Amazon WAF, ModSecurity, IronBee, NAXSI, WebKnight, Shadow Daemon

## Tools

Look for open source tools that are commonly used for penetration testing. These tools gave some pretty good insight on where the app needed securing.

*   [nikto2](https://cirt.net/Nikto2)
*   [sqlmap](http://sqlmap.org/)
*   [OWASP Zap](https://www.owasp.org/index.php/OWASP_Zed_Attack_Proxy_Project)

## Takeaways

*   Don't rely on just one layer of protection.
*   Use established frameworks.
*   Use the same tools as the pen testers.

## References

[https://stackoverflow.com/search?q=XSS](https://stackoverflow.com/search?q=XSS) (21k and counting!) [https://www.owasp.org/index.php/Main_Page](https://www.owasp.org/index.php/Main_Page) [https://msdn.microsoft.com/en-us/library/ff649310.aspx](https://msdn.microsoft.com/en-us/library/ff649310.aspx) [https://developer.mozilla.org/en-US/docs/Web/HTTP/CSP](https://developer.mozilla.org/en-US/docs/Web/HTTP/CSP)