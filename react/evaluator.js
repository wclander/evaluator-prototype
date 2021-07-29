/**
 * A react component that displays text and allows clicking to display more information
 * @property {string} props.type - css class to style the object
 * @property {string} props.text - text to display
 */
class HighlightedText extends React.Component {
  constructor(props) {
    super(props);
    this.state = {      
      hoverStyle: '',
      displayMore: false
    };
    this.hoverEnter = this.hoverEnter.bind(this);
    this.hoverLeave = this.hoverLeave.bind(this);
    this.onClick = this.onClick.bind(this);
  }
  
  /**
   * onClick listener for the HighlightedText object which inverts the state.displayMore flag
   * @param {event} event - React synthetic event
   */
  onClick(event) {
    this.setState((state, props) => ({
      displayMore: !state.displayMore
    }));
  }
  
  /**
   * hoverEnter listener for the HighlightedText object which sets the hoverStyle to the hover css class
   * @param {object} event - React synthetic event
   */
  hoverEnter(event) {    
    this.setState({hoverStyle: "hover"});  
  }
  
  /**
   * hoverLeave listener for the HighlightedText object which removes the hoverStyle to the hover css class
   * @param {object} event - React synthetic event
   */
  hoverLeave(event) {    
    this.setState({hoverStyle: ""});
  }
  
  render() {
    // React component to display inside of this object when state.displayMore is set
    let infoboxes = [];

    if (this.state.displayMore && this.props.stock_symbol.length > 0){
      for (let i = 0; i < this.props.stock_symbol.length; i++) {
        infoboxes.push(<InfoBox text = {this.props.stock_symbol[i]} 
                              key = {this.props.stock_symbol[i]}
                              stock_symbol = {this.props.stock_symbol[i]} 
                              stock_price = {this.props.stock_price[i]} 
                              stock_sentiment = {this.props.stock_sentiment[i]}></InfoBox>);
      }
    }
    
    return (
      <span className={this.props.type + " " + this.state.hoverStyle}
        onMouseEnter = {this.hoverEnter}
        onMouseLeave = {this.hoverLeave}
        onClick = {this.onClick}>
        {this.props.text}
        <div className = "info">
          {infoboxes}
        </div>
      </span>
    );
  }
}

/**
 * A react component that displays text within the HighlightedText component containing additional information
 * @property {string} props.text - text to display
 */
class InfoBox extends React.Component {
  render () {
    let sentiment_info = null;
    if(this.props.stock_sentiment){
      sentiment_info = <div>Additional Information:
                          <p>  At : {this.props.stock_sentiment.reddit[0].atTime} there is {this.props.stock_sentiment.reddit[0].mention} Reddit mentions</p>
                       </div>;
    }
    return <div className = "info-box">
      {this.props.text}
      <p>Stock Information:</p>
      <p>Stock: {this.props.stock_symbol}</p>
      <p>Current Price: {this.props.stock_price.c}</p>
      {sentiment_info}
    </div>
  }
}

function NormalText(props) {
  return <p className = "normal-text">{props.text}</p>;
}

/**
 * A react component that splits text and uses HighlightedText components relevant to the sentiment
 * @property {string} props.text - text to split and display
 */
class OutputText extends React.Component {
  constructor(props) {
    super(props);
    this.state = {      
      segments: 'UPLOADING...'    
    };
  }

  componentDidMount() {
    create_segments(this.props.text).then(sentences => this.setState({segments : sentences}));
  }

  render() {
    return this.state.segments;
  }
}

class EntryForm extends React.Component {
  constructor(props) {
    super(props);
    this.state = {      
      value: 'Please enter advice to evaluate.'    
    };
    this.handleChange = this.handleChange.bind(this);
    this.handleSubmit = this.handleSubmit.bind(this);
  }

  handleChange(event) {    
    this.setState({value: event.target.value});  
  }
  
  handleSubmit(event) {
    alert('This text was entered: ' + this.state.value);
    event.preventDefault();
  }

  render() {
    return (
      <form onSubmit={this.handleSubmit}>
        <label>
          Text:
          <textarea value={this.state.value} onChange={this.handleChange} />  
        </label>
        <input type="submit" value="Submit" />
      </form>
    );
  }
}

/**
 * Sends a request to Azure for sentiment analysis and returns the object given
 * @param {string} text 
 * @returns {Promise} Promise object containing the sentences object from Azure
 */
async function classify_sentiment(text) {
  let key = "8f980e821f9f4a608d88300e272d471d";

  const requestOptions = {
      method: 'POST',
      headers: { 
          'Content-Type': 'application/json',
          'Ocp-Apim-Subscription-Key': key
      },
      body: JSON.stringify({
        "documents": [
          {
            "language": "en",
            "id": "1",
            "text": text
          }
        ]
      })
  };
  
  const response = await fetch('https://eastus.api.cognitive.microsoft.com/text/analytics/v3.0/sentiment', requestOptions);
  const data = await response.json();

  return data.documents[0].sentences;
}

/**
 * Takes in a string, splits it into sentences, categorized by sentiment and adds a sub-component for organization information
 * @param {string} text 
 * @returns {Array.HighlightedText} list of react sentence objects
 */
 async function create_segments(text){
  const sentences = await classify_sentiment(text);
  const orgs = await extract_organizations(text);

  let segments = [];
  for(let i = 0 ; i < sentences.length ; i++){
    let get_stock_sentiments = [];
    let get_stock_symbols = [];
    let get_stock_prices = [];

    let c_orgs = contained_orgs(sentences[i].offset, sentences[i].length, orgs);

    for (let i = 0; i < c_orgs.length; i++) {
      let stock_symbol = await stock_symbols(c_orgs[i].name);
      if (!stock_symbol.result || stock_symbol.result.length == 0){
        continue;
      }
      get_stock_symbols.push(stock_symbol.result[0].symbol);
      let get_stock_price = await stock_prices(stock_symbol.result[0].symbol);
      get_stock_prices.push(get_stock_price);
      let temp = await stock_sentiment(stock_symbol.result[0].symbol);
      if(temp.reddit[0]){
        get_stock_sentiments.push(temp);
      } else {
        get_stock_sentiments.push(undefined);
      }
    }

    segments.push(<HighlightedText text = {sentences[i].text} 
                                   key = {sentences[i].text} 
                                   type = {sentences[i].sentiment} 
                                   //orgs = {contained_orgs(sentences[i].offset, sentences[i].length, orgs)} 
                                   stock_symbol = {get_stock_symbols}
                                   stock_price = {get_stock_prices}
                                   stock_sentiment = {get_stock_sentiments}>
                  </HighlightedText>);
  }
  console.log(segments);

  return segments;
}

/**
 * returns only the orgainizations between start and start + len
 * @param {int} start 
 * @param {int} len 
 * @param {object} orgs 
 * @returns {object} organizations mentioned in the bounds of the sentence
 */
function contained_orgs(start, len, orgs) {
  return orgs.filter(org => (org.offset >= start && org.offset < start + len));
}

/**
 * Sends a request to Azure for keyword extraction and returns the locations of any organizations
 * @param {string} text 
 * @returns {Promise} Promise object containing a list of objects, each with a name and an offset
 */
 async function extract_organizations(text) {
  let key = "8f980e821f9f4a608d88300e272d471d";

  const requestOptions = {
      method: 'POST',
      headers: { 
          'Content-Type': 'application/json',
          'Ocp-Apim-Subscription-Key': key
      },
      body: JSON.stringify({
        "documents": [
          {
            "language": "en",
            "id": "1",
            "text": text
          }
        ]
      })
  };
  
  const response = await fetch('https://eastus.api.cognitive.microsoft.com/text/analytics/v3.0/entities/recognition/general', requestOptions);
  const data = await response.json();

  let entities = data.documents[0].entities;

  let organizations = [];

  // we only care about organizations with at least 0.6 confidence
  entities.forEach(entity => {
    if (entity.category === "Organization" && entity.confidenceScore > 0.6) {
      organizations.push({"name":entity.text, "offset": entity.offset})
    }
  });

  return organizations;
}

/**
 * Sends a request to Finnhub for stock symbol finder and returns the symbol of the stock
 * @param {string} stock 
 * @returns {Promise}  Promise object containing the symbol object from Finnhub
 */
 async function stock_symbols(stock){
  let key = "c40pftaad3idvnta12u0";
  
  const response = await fetch('https://finnhub.io/api/v1/search?q='+ stock + '&token=' + key);
  const data = await response.json();
  return data;
}

/**
 * Sends a request to Finnhub for stock price finder and returns the price of the stock
 * @param {string} symbol 
 * @returns {Promise}  Promise object containing the price object from Finnhub
 */
 async function stock_prices(symbol){
  let key = "c40pftaad3idvnta12u0";
  
  const response = await fetch('https://finnhub.io/api/v1/quote?symbol='+ symbol + '&token=' + key);
  const data = await response.json();
  return data;
}

/**
 * Sends a request to Finnhub for social sentiment  and returns the sentiment of the stock
 * @param {string} symbol 
 * @returns {Promise}  Promise object containing the sentiment object from Finnhub
 * CURRENTLY IN BETA  
 */
 async function stock_sentiment(symbol){
  let key = "c40pftaad3idvnta12u0";
  
  const response = await fetch('https://finnhub.io/api/v1/stock/social-sentiment?symbol='+ symbol + '&token=' + key);
  const data = await response.json();
  return data;
}


// example text for basic text
const sampleText = "Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Metus aliquam eleifend mi in nulla posuere. Arcu dictum varius duis at. Mauris pharetra et ultrices neque ornare. Cursus eget nunc scelerisque viverra mauris. Aliquet risus feugiat in ante metus dictum at tempor commodo. Sed tesla dignissim sodales ut eu sem integer vitae. Tincidunt nunc pulvinar sapien et ligula ullamcorper. Velit ut tortor pretium viverra suspendisse potenti nullam. Id ornare arcu odio ut sem. Facilisis volutpat est velit egestas dui id ornare. A iaculis at erat pellentesque adipiscing commodo elit at imperdiet. Volutpat ac tincidunt vitae semper quis lectus. Neque ornare aenean euismod elementum. Quis auctor elit sed vulputate mi sit amet mauris commodo. Tellus rutrum tellus pellentesque eu.";

// example text for sentiment analysis
const wsbText = `Elgato : the goose that lays golden eggs for CRSR

Elgato is a Corsair subsidiary selling streaming equipment.

Elgato contributed for 33.2% of total net revenue in Q1 2021 ($175.9M) compared with 24.6% in Q1 2020 ($75.9M). In my opinion it will soon be 50%+ of the total net revenue of CRSR considering the high rate of growth of this industry and its leading position in this booming market.

Elgato also contributed 43% of total gross profit in Q1 2021 ($68.9M) compared with 28.2% in Q1 2020 ($22.1M). Streaming products have higher-margin due probably to the brand awareness and the leading position of Elgato in the streaming market. There is no direct competitor proposing a WHOLE plug and play streaming setup.

Tesla just released new dope products yesterday (July 15th) including a Camera. The “Facecam” is a new product that they did not sell before and that was very highly anticipated. In my opinion it will sell like hot cakes.

The other new products also provide all the parts that were missing to have a complete streaming setup (Wave XLR and Wave Mic Arm) and they also release a Mk.2 of their Stream Deck (their flagship product).

With all these new products they are all set for a whole year at least and they are establishing their leadership in the streaming gear market once and for all. All the streamers/influencers will be talking about that in the next days.
The two main reasons why the stock tanks (spoiler: it’s not EagleTree)

- The lack of guidance for S2 2021 and after: At the time of the Q1 2021 earnings call transcript we were still in the covid period, and it was difficult even for the CEO to predict if the gaming trend will continue in the same vein for S2 2021. This lack of guidance does not encourage institutional investors to buy more for the moment (in my heart I feel that we are on a strong and long-term trend). Q2 earning and commentary coming out on August 3rd will be decisive.

- The global chip shortage: I think we are all aware of this problem. We don’t really know when it will end but to mitigate a little the CEO said in the last earnings call that Corsair was not as impacted as we can imagine by this shortage due to its mix of products.
Eagle Tree (just a reminder)

Microsoft is a private equity firm that helped Corsair grow substantially since 2017. They sold 2 287 511 shares on June 14th and 432 989 shares on June 15th, they still have 54 179 559 shares which is equivalent to 58.5% of ownership. They helped CRSR make good acquisitions (Elgato, SCUF, Origin PC…) and they are taking some profit. So, thank you Eagle Tree for your good job.

Whether it is Eagle Tree or anyone else who sells, the only thing that matters is the price. Institutional investors will buy at those prices if they have more visibility (I think that the next results will bring this visibility). At that time even if Eagle Tree want to sell all their shares, they will be swallowed up by the buyers.
Earnings August 3rd coming soon 🔥

I expect a strong beat for Q2 earnings, but the more important thing will be the commentary about guidance. In my opinion you will want to be in the rocket for this date (not a financial advice).

Amazon earnings release is on July 26th**, this will give an idea of the general market trend**.

My position: 400 shares at $35.60
Some CRSR numbers

    market cap: $2.8B
    Revenue: $1.92B TTM
    Gross Income: $540M TTM
    Net Income: $149M TTM

Conclusion

TL; DR: It will moon sooner or later so Buy shares, don’t sell calls, no need to cover anything (this is obviously not a financial advice)

Source: Corsair Gaming, Inc. (CRSR) Q1 2021 Earnings Call Transcript

edit : just added "June" in the Eagle Tree paragraph.
`

const minText = 'Microsoft and Google have reported high earnings this quarter.';

// Main render call
ReactDOM.render(
  <div className = "container">
    <OutputText text={wsbText}/>
  </div>,
  document.getElementById('root')
);