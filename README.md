passport-negotiate
============================

Negotiate (Kerberos) single-sign-on authentication strategy for Passport.

This [Passport](http://passportjs.org/) strategy implements authentication of users 
implementing "HTTP Negotiate", or SPNEGO auth-scheme, as described in 
[RFC 4559](https://www.ietf.org/rfc/rfc4559.txt).

For this to work, clients (browsers) must have access to a "credentials cache", which 
happens when logging in to a Domain in Windows, or in Linux/Unix either by
using the "kinit" tool directly, or by using PAM modules which do this at login
time, for example using sssd with a kerberos DC or Active Directory Domain Controller
such as Samba 4.

When "Negotiate" is requested by the server, via a "WWW-Authenticate: Negotiate" 
header and a 401 response, the browser will obtain credentials in the form of
a "ticket".  The browser will then re-request the resource with the ticket
data provided in the "Authorization: Negotiate .....".  This happens 
transparently to the user.

Node.js can also be made to work as a negotiate enabled _client_, see this [Gist](https://gist.github.com/dmansfield/c75817dcacc2393da0a7).

## Install

    $ npm install passport-negotiate

## Usage

#### Configure Strategy

The kerberos authentication strategy authenticates users using a username and
password.  The strategy requires a `verify` callback, which accepts the user's
kerberos principal and calls `done` providing a user. Kerberos principals 
typically look like user@REALM.

    var NegotiateStrategy = require("passport-negotiate");
    passport.use(new NegotiateStrategy(function(principal, done) {
        User.findOne({ principal: principal }, function (err, user) {
            return done(err, user);
        });
      }
    ));

There are some quirks worth noting:

1. You _must not_ use `failureRedirect` when using the authentication method 
as middleware, because the strategy must generate a 401 status response with 
a specific header (WWW-Authenticate: Negotiate), which won't happen if 
`failureRedirect` is used.
2. Kerberos authentication can succeed, but the supplied `verify` function 
cannot find a user object for the user.  In this case, a `noUserRedirect` can
be supplied which will in many respects work the way `failureRedirect` works
for other strategies. The sample application `examples/login` demonstrates this.
The strategy will set `req.session.authenticatedPrincipal` to the authenticated 
principal whenever kerberos authentication has succeeded regardless of the 
(in-)ability of the `verify` function to supply a user object.

#### S4U2Proxy (credential delegation)

The strategy can be configured to obtain delegated credentials on 
behalf of the authenticated user.  Enable this by passing an options hash as
the first argument to the strategy constructor:

    passport.use(new NegotiateStrategy({enableConstrainedDelegation:true}, ...) 

The delegated credentials will be stored in a per-session credentials
cache (the name of which will be set in `req.session.delegatedCredentialsCache`).
Currently there is no code to monitor the lifetime of these credentials, so you will
need to ensure the cache is not expired, and also to remove the cache file
when the session is closed.

**Note 1**: S4U2Proxy support is currently WIP, and hasn't been rolled into an 
official release of the `kerberos` module that provides the underlying functionality.
To get support for S4U2Proxy please use [this fork.](https://github.com/dmansfield/kerberos/tree/s4u)
The authors are currently working on getting this code merged upstream.

**Note 2**: For S4U2Proxy credentials to be obtained, a credentials cache for the
server principal (in addition to the keytab) must be established and maintained. 
For example, supposing the service keytab contains a credential for the principal
`HTTP/myhost.example.com@MYREALM.COM`, then you could create a credentials cache
in the default location using:

    kinit -k HTTP/myhost.example.com@MYREALM.COM

Alternatively, you could use k5start to ensure that the credentials cache is renewed
and/or recreated so as to be valid over a long period of time

By default the service principal will NOT be enabled for S4U2Proxy. 
[This wiki page](http://k5wiki.kerberos.org/wiki/Manual_Testing#Services4User_testing)
on the kerberos website includes information on how to set up a principal
to allow S4U2Proxy. Note: the UPN should be HTTP/myhost.example.com not host/myhost.example.com
in all likelyhood.

## Credits

  - [David Mansfield](http://github.com/dmansfield)
  
## License

[The MIT License](http://opensource.org/licenses/MIT)

Copyright (c) 2015 David Mansfield
