//*************************************************************************
// HTML Validator
//
//  File: tidyThread.js
//  Description: javascript to manage threads
//  Author : Marc Gueury
//  Licence : see licence.txt
//*************************************************************************

function TestThread() 
{
  var myThread = new ThreadRunner();
  const mainJob=function() 
  {
    oTidyUtil.tidy.log( 'mainjob' );
  }
  const postJob=function() 
  { 
    oTidyUtil.tidy.log( 'postjob' );
  }
  myThread.run(mainJob,postJob);
  oTidyUtil.tidy.log( 'mainthread' );
}


//- Factory THREAD_FACTORY ------------------------------------------------
const THREAD_FACTORY = 
{
  createThread: function(runnable) 
  {
    const cc=Components.classes;
    const ci=Components.interfaces;
    const thread=cc['@mozilla.org/thread;1'].createInstance(ci.nsIThread);
    if(runnable) 
    {
      runnable.thread=thread;
      thread.init(runnable, 0,  
            ci.nsIThread.PRIORITY_NORMAL, ci.nsIThread.SCOPE_GLOBAL, ci.nsIThread.STATE_JOINABLE);
    }
    return thread;
  }
}

//- Class ThreadRunner ------------------------------------------------
function ThreadRunner() 
{
}

ThreadRunner.prototype=
{
  run: function(mainJob, postJob) 
  {
    const cc=Components.classes;
    const ci=Components.interfaces;
  
    var postRunnable=null;
    const oThreadError={ value: null };
    if(postJob) 
    {
      postRunnable = cc["@mozilla.org/xpcomproxy;1"].getService(ci.nsIProxyObjectManager
       ).getProxyForObject(
          cc["@mozilla.org/event-queue-service;1"].getService(ci.nsIEventQueueService
              ).getSpecialEventQueue(ci.nsIEventQueueService.UI_THREAD_EVENT_QUEUE),
          ci.nsIRunnable, 
          {
            QueryInterface: function(iid) 
            {
              if(iid.equals(ci.nsISupport) || iid.equals(ci.nsIRunnable)) 
              {
               return this;
              }
              throw Components.results.NS_ERROR_NO_INTERFACE;
            },
            run: function() 
            { 
              if(oThreadError.value) 
              {
                oTidyUtil.tidy.log( 'ThreadRunner mainJob error: '+oThreadError.value );
              }
              // try 
              // {
              postJob();
              // } catch(ex) {
              //  dump("ThreadRunner postJob error: "+ex+"\n");
              // }
            }
          }
        , 5); // 5 == PROXY_ALWAYS | PROXY_SYNC
    }   
    const asyncRunnable=
    {
      run: function() 
      { 
        try {
          mainJob();
        } catch(ex) {
          oThreadError.value=ex;
        }
        if(postRunnable) postRunnable.run();
      }
    };
    
    THREAD_FACTORY.createThread( asyncRunnable );
  }  
}

