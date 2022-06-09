
export interface CollapsedCursor {
    type: "collapsed";
    targetId: string;
    offset: number;
  }
  
  export interface OpenCursorState {
    type: "open";
    startId: string;
    startOffset: number;
    endId: string;
    endOffset: number;
  }
  
  export type CursorState = CollapsedCursor | OpenCursorState;
  