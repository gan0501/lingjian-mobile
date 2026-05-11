#import <Foundation/Foundation.h>
#import <GCDWebServer/GCDWebServer.h>

@interface AssetServerBridge : NSObject
+ (NSUInteger)startServerWithResourcePath:(NSString *)resourcePath;
+ (void)stopServer;
@end

static GCDWebServer *_webServer = nil;

@implementation AssetServerBridge

+ (NSUInteger)startServerWithResourcePath:(NSString *)resourcePath {
    if (_webServer != nil) {
        return _webServer.port;
    }
    
    GCDWebServer *server = [[GCDWebServer alloc] init];
    
    [server addGETHandlerForBasePath:@"/"
                       directoryPath:resourcePath
                    indexFilename:nil
                         cacheAge:0
                  allowRangeRequests:YES];
    
    NSDictionary *options = @{
        GCDWebServerOption_Port: @(38080),
        GCDWebServerOption_BindToLocalhost: @YES
    };
    
    NSError *error = nil;
    if (![server startWithOptions:options error:&error]) {
        NSLog(@"[AssetServer] Failed to start: %@", error.localizedDescription);
        return 0;
    }
    
    _webServer = server;
    return server.port;
}

+ (void)stopServer {
    [_webServer stop];
    _webServer = nil;
}

@end
