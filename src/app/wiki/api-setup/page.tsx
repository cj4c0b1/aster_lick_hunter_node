import { Key, ExternalLink, Shield, AlertTriangle, Copy, CheckCircle, Settings } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

export default function ApiSetupPage() {
  return (
    <div className="space-y-8">
      <div className="space-y-2">
        <h1 className="text-3xl font-bold flex items-center gap-3">
          <Key className="h-8 w-8 text-primary" />
          API Setup Guide
        </h1>
        <p className="text-muted-foreground">
          Complete guide to connecting your AsterDex account for live trading
        </p>
      </div>

      <Alert className="border-yellow-500/50 bg-yellow-500/10">
        <AlertTriangle className="h-4 w-4 text-yellow-500" />
        <AlertDescription>
          <strong>Security Notice:</strong> Never share your API keys with anyone. The bot stores them locally and they are never transmitted to external servers.
        </AlertDescription>
      </Alert>

      <Card>
        <CardHeader>
          <CardTitle>Step 1: Create or Access Your AsterDex Account</CardTitle>
          <CardDescription>You need an account to generate API keys for trading</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-3">
            <Alert className="border-blue-500/50 bg-blue-500/10">
              <AlertDescription>
                <strong>New to AsterDex?</strong> Sign up with our referral link to support the project and get benefits!
              </AlertDescription>
            </Alert>

            <Button className="w-full" asChild>
              <a href="https://www.asterdex.com/en/referral/3TixB2" target="_blank" rel="noopener noreferrer">
                <ExternalLink className="mr-2 h-4 w-4" />
                Open AsterDex (Sign Up / API Management)
              </a>
            </Button>

            <div className="bg-muted p-4 rounded-lg">
              <p className="text-sm text-muted-foreground">
                <strong>Note:</strong> After creating your account, you&apos;ll need to navigate to the API management section to generate your trading keys.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Step 2: Create New API Key</CardTitle>
          <CardDescription>Generate API credentials for the bot</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-4">
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Badge>2.1</Badge>
                <span className="font-medium">Click &quot;Create API&quot; Button</span>
              </div>
              <p className="text-sm text-muted-foreground ml-10">
                Look for the &quot;Create API&quot; or &quot;Generate API Key&quot; button on the page
              </p>
            </div>

            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Badge>2.2</Badge>
                <span className="font-medium">Set API Label</span>
              </div>
              <p className="text-sm text-muted-foreground ml-10">
                Give your API a descriptive name like &quot;Liquidation Hunter Bot&quot; to identify it later
              </p>
            </div>

            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Badge>2.3</Badge>
                <span className="font-medium">IP Whitelist (Optional)</span>
              </div>
              <p className="text-sm text-muted-foreground ml-10">
                For enhanced security, you can restrict API access to your IP address.
                Leave blank to allow access from any IP.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Step 3: Save Your Keys</CardTitle>
          <CardDescription>Copy and securely store your API credentials</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Alert className="border-red-500/50 bg-red-500/10">
            <AlertTriangle className="h-4 w-4 text-red-500" />
            <AlertDescription>
              <strong>Critical:</strong> The Secret Key is shown only once! Copy it immediately or you&apos;ll need to create a new API key.
            </AlertDescription>
          </Alert>

          <div className="space-y-3">
            <div className="p-4 bg-muted rounded-lg space-y-3">
              <div>
                <p className="text-sm font-medium mb-1">API Key (Public)</p>
                <div className="flex items-center gap-2">
                  <code className="flex-1 bg-background p-2 rounded text-xs">
                    64-character string starting with...
                  </code>
                  <Button size="icon" variant="ghost">
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              <div>
                <p className="text-sm font-medium mb-1">Secret Key (Private)</p>
                <div className="flex items-center gap-2">
                  <code className="flex-1 bg-background p-2 rounded text-xs">
                    Another 64-character string...
                  </code>
                  <Button size="icon" variant="ghost">
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <h4 className="font-medium">Key Characteristics:</h4>
              <ul className="list-disc list-inside text-sm text-muted-foreground space-y-1">
                <li>Both keys are exactly 64 characters long</li>
                <li>Contains only letters and numbers</li>
                <li>Case-sensitive - copy exactly as shown</li>
                <li>No spaces or special characters</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Step 4: Configure the Bot</CardTitle>
          <CardDescription>Enter your API keys in the application</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-3">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <Badge>Option A</Badge>
                <span className="font-medium">Through Web UI</span>
              </div>
              <ol className="list-decimal list-inside text-sm text-muted-foreground space-y-1 ml-4">
                <li>Open the dashboard at <code>http://localhost:3000</code></li>
                <li>Navigate to Configuration page</li>
                <li>Enter your API Key and Secret Key</li>
                <li>Click Save Configuration</li>
              </ol>
            </div>

            <div>
              <div className="flex items-center gap-2 mb-2">
                <Badge>Option B</Badge>
                <span className="font-medium">Manual Configuration</span>
              </div>
              <ol className="list-decimal list-inside text-sm text-muted-foreground space-y-1 ml-4">
                <li>Open <code>config.user.json</code> in a text editor</li>
                <li>Add your keys to the api section:</li>
              </ol>
              <div className="bg-muted p-3 rounded-lg font-mono text-xs mt-2 ml-4">
                {`{
  "api": {
    "apiKey": "your-64-character-api-key",
    "secretKey": "your-64-character-secret-key"
  }
}`}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Security Best Practices
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-start gap-3">
            <CheckCircle className="h-5 w-5 text-green-500 mt-0.5" />
            <div>
              <p className="font-medium">Never share your API keys</p>
              <p className="text-sm text-muted-foreground">Keep them private and secure</p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <CheckCircle className="h-5 w-5 text-green-500 mt-0.5" />
            <div>
              <p className="font-medium">Use IP whitelisting</p>
              <p className="text-sm text-muted-foreground">Restrict API access to your IP address</p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <CheckCircle className="h-5 w-5 text-green-500 mt-0.5" />
            <div>
              <p className="font-medium">Rotate keys periodically</p>
              <p className="text-sm text-muted-foreground">Create new keys every few months</p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <CheckCircle className="h-5 w-5 text-green-500 mt-0.5" />
            <div>
              <p className="font-medium">Monitor API activity</p>
              <p className="text-sm text-muted-foreground">Check your API usage regularly in AsterDex</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Testing Your Connection
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            After entering your API keys, the bot will automatically test the connection. You should see:
          </p>
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <div className="h-2 w-2 bg-green-500 rounded-full animate-pulse" />
              <span className="text-sm">Green &quot;Connected&quot; status in the sidebar</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="h-2 w-2 bg-green-500 rounded-full animate-pulse" />
              <span className="text-sm">Your account balance displayed</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="h-2 w-2 bg-green-500 rounded-full animate-pulse" />
              <span className="text-sm">Live liquidation feed updating</span>
            </div>
          </div>

          <Alert>
            <AlertDescription>
              If you see connection errors, verify your API keys are correct and that you&apos;ve enabled the proper permissions.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    </div>
  );
}