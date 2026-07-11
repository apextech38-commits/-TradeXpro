import React, { useCallback, useEffect, useRef, useState } from 'react';
import { observer } from 'mobx-react-lite';
import { DBOT_TABS } from '@/constants/bot-contents';
import { api_base, load, observer as globalObserver } from '@/external/bot-skeleton';
import { useStore } from '@/hooks/useStore';
import { getLastDigitFromQuote } from '@/utils/market-data';
import { safeSubscribe } from '@/utils/websocket-handler';
import { Localize, localize } from '@deriv-com/translations';
import { useDevice } from '@deriv-com/ui';
import './scanner.scss';

// Market Indices list
const MARKETS = [
    { label: 'Volatility 10 Index', symbol: 'R_10' },
    { label: 'Volatility 25 Index', symbol: 'R_25' },
    { label: 'Volatility 50 Index', symbol: 'R_50' },
    { label: 'Volatility 75 Index', symbol: 'R_75' },
    { label: 'Volatility 100 Index', symbol: 'R_100' },
    { label: 'Volatility 10(1s) Index', symbol: '1HZ10V' },
    { label: 'Volatility 25(1s) Index', symbol: '1HZ25V' },
    { label: 'Volatility 50(1s) Index', symbol: '1HZ50V' },
    { label: 'Volatility 75(1s) Index', symbol: '1HZ75V' },
    { label: 'Volatility 100(1s) Index', symbol: '1HZ100V' },
];

// Strategies configuration
const STRATEGY_DEFINITIONS = [
    { id: 'even_odd', name: 'Even / Odd', type: 'standard' },
    { id: 'over_under', name: 'Over / Under (4.5)', type: 'standard' },
    { id: 'matches', name: 'Matches', type: 'standard' },
    { id: 'differs', name: 'Differs', type: 'standard' },
    { id: 'rise_fall', name: 'Rise / Fall', type: 'standard' },
    { id: 'pro_even_odd', name: 'Pro Even / Odd', type: 'pro' },
    { id: 'pro_over_under', name: 'Pro Over / Under', type: 'pro' },
    { id: 'pro_differs', name: 'Pro Differs', type: 'pro' },
    { id: 'under_7', name: 'Under 7 Strategy', type: 'pro' },
    { id: 'over_2', name: 'Over 2 Strategy', type: 'pro' },
    { id: 'super_signals', name: 'Super Signals (Real-time)', type: 'super' },
];

type TTickPoint = {
    epoch: number;
    quote: number;
};

type TAnalysisResult = {
    digitFrequencies: { digit: number; count: number; percentage: number }[];
    evenCount: number;
    oddCount: number;
    evenPercentage: number;
    oddPercentage: number;
    highCount: number;
    lowCount: number;
    highPercentage: number;
    lowPercentage: number;
    entropy: number;
    powerIndex: {
        strongest: number;
        weakest: number;
        gap: number;
    };
    missingDigits: number[];
    streaks: { digit: number; count: number }[];
    totalTicks: number;
};

type TSignal = {
    type: string;
    strategyName: string;
    status: 'STRONG' | 'TRADE NOW' | 'WAIT' | 'NEUTRAL';
    probability: number;
    recommendation: string;
    entryCondition: string;
    targetDigit?: number;
};

// Shannon Entropy calculations
const calculateEntropy = (frequencies: { percentage: number }[]) => {
    let entropy = 0;
    frequencies.forEach(f => {
        const p = f.percentage / 100;
        if (p > 0) {
            entropy -= p * Math.log2(p);
        }
    });
    return entropy;
};

// Streak detection
const getStreaks = (digits: number[]) => {
    if (digits.length === 0) return [];
    const streaks: { digit: number; count: number }[] = [];
    let currentDigit = digits[0];
    let currentCount = 1;
    for (let i = 1; i < digits.length; i++) {
        if (digits[i] === currentDigit) {
            currentCount++;
        } else {
            if (currentCount >= 2) {
                streaks.push({ digit: currentDigit, count: currentCount });
            }
            currentDigit = digits[i];
            currentCount = 1;
        }
    }
    if (currentCount >= 2) {
        streaks.push({ digit: currentDigit, count: currentCount });
    }
    return streaks.slice(-5);
};

// Core signals engine
const runAnalysis = (ticks: TTickPoint[], symbol: string): TAnalysisResult => {
    const lastDigits = ticks.map(t => getLastDigitFromQuote(t.quote, symbol));
    const totalTicks = lastDigits.length || 1;

    // Digit frequencies
    const digitCounts = Array(10).fill(0);
    lastDigits.forEach(d => {
        if (d >= 0 && d <= 9) digitCounts[d]++;
    });

    const digitFrequencies = digitCounts.map((count, digit) => ({
        digit,
        count,
        percentage: (count / totalTicks) * 100,
    }));

    // Even / Odd
    const evenCount = lastDigits.filter(d => d % 2 === 0).length;
    const oddCount = totalTicks - evenCount;

    // High / Low
    const highCount = lastDigits.filter(d => d >= 5).length;
    const lowCount = totalTicks - highCount;

    // Entropy
    const entropy = calculateEntropy(digitFrequencies);

    // Power Index
    let strongest = 0;
    let weakest = 0;
    let maxPct = -1;
    let minPct = 101;

    digitFrequencies.forEach(f => {
        if (f.percentage > maxPct) {
            maxPct = f.percentage;
            strongest = f.digit;
        }
        if (f.percentage < minPct) {
            minPct = f.percentage;
            weakest = f.digit;
        }
    });

    const missingDigits: number[] = [];
    digitFrequencies.forEach(f => {
        if (f.count === 0) missingDigits.push(f.digit);
    });

    const streaks = getStreaks(lastDigits);

    return {
        digitFrequencies,
        evenCount,
        oddCount,
        evenPercentage: (evenCount / totalTicks) * 100,
        oddPercentage: (oddCount / totalTicks) * 100,
        highPercentage: (highCount / totalTicks) * 100,
        lowPercentage: (lowCount / totalTicks) * 100,
        highCount,
        lowCount,
        entropy,
        powerIndex: {
            strongest,
            weakest,
            gap: maxPct - minPct,
        },
        missingDigits,
        streaks,
        totalTicks,
    };
};

const generateSignals = (analysis: TAnalysisResult, ticks: TTickPoint[]): TSignal[] => {
    const signals: TSignal[] = [];

    // 1. Even / Odd
    const maxEvenOdd = Math.max(analysis.evenPercentage, analysis.oddPercentage);
    const isEvenFavored = analysis.evenPercentage >= analysis.oddPercentage;
    if (maxEvenOdd >= 60) {
        signals.push({
            type: 'even_odd',
            strategyName: 'Even / Odd',
            status: 'TRADE NOW',
            probability: maxEvenOdd,
            recommendation: isEvenFavored ? 'EVEN' : 'ODD',
            entryCondition: `Wait for 2+ consecutive opposite (${isEvenFavored ? 'ODD' : 'EVEN'}) digits, then trade favored`,
        });
    } else if (maxEvenOdd >= 55) {
        signals.push({
            type: 'even_odd',
            strategyName: 'Even / Odd',
            status: 'WAIT',
            probability: maxEvenOdd,
            recommendation: isEvenFavored ? 'EVEN' : 'ODD',
            entryCondition: 'Moderate bias - Monitor for stronger signal',
        });
    }

    // 2. Over / Under (4.5)
    const maxHighLow = Math.max(analysis.highPercentage, analysis.lowPercentage);
    const isHighFavored = analysis.highPercentage >= analysis.lowPercentage;
    if (maxHighLow >= 62 && analysis.powerIndex.gap >= 15) {
        signals.push({
            type: 'over_under',
            strategyName: 'Over / Under (4.5)',
            status: 'TRADE NOW',
            probability: maxHighLow,
            recommendation: isHighFavored ? 'OVER 4.5' : 'UNDER 4.5',
            entryCondition: `Trade when strongest digit (${analysis.powerIndex.strongest}) appears`,
            targetDigit: 4,
        });
    } else if (maxHighLow >= 58) {
        signals.push({
            type: 'over_under',
            strategyName: 'Over / Under (4.5)',
            status: 'WAIT',
            probability: maxHighLow,
            recommendation: isHighFavored ? 'OVER 4.5' : 'UNDER 4.5',
            entryCondition: 'Wait for power gap to increase',
            targetDigit: 4,
        });
    }

    // 3. Matches
    const strongestDigitFreq = analysis.digitFrequencies[analysis.powerIndex.strongest].percentage;
    if (strongestDigitFreq >= 15) {
        signals.push({
            type: 'matches',
            strategyName: 'Matches',
            status: 'TRADE NOW',
            probability: strongestDigitFreq * 5, // scaled for matches confidence
            recommendation: `MATCH Digit ${analysis.powerIndex.strongest}`,
            entryCondition: `Trade MATCHES immediately when digit ${analysis.powerIndex.strongest} appears`,
            targetDigit: analysis.powerIndex.strongest,
        });
    } else if (strongestDigitFreq >= 12) {
        signals.push({
            type: 'matches',
            strategyName: 'Matches',
            status: 'WAIT',
            probability: strongestDigitFreq * 5,
            recommendation: `MATCH Digit ${analysis.powerIndex.strongest}`,
            entryCondition: 'Digit showing moderate frequency - Wait for index increase',
            targetDigit: analysis.powerIndex.strongest,
        });
    }

    // 4. Differs
    const weakestDigitFreq = analysis.digitFrequencies[analysis.powerIndex.weakest].percentage;
    if (weakestDigitFreq < 9) {
        signals.push({
            type: 'differs',
            strategyName: 'Differs',
            status: 'TRADE NOW',
            probability: 100 - weakestDigitFreq,
            recommendation: `DIFFER Digit ${analysis.powerIndex.weakest}`,
            entryCondition: `Wait for rare digit ${analysis.powerIndex.weakest} to appear, then trade DIFFERS`,
            targetDigit: analysis.powerIndex.weakest,
        });
    }

    // 5. Rise / Fall
    if (ticks.length >= 10) {
        const last10 = ticks.slice(-10);
        let ups = 0;
        let downs = 0;
        for (let i = 1; i < last10.length; i++) {
            if (last10[i].quote > last10[i - 1].quote) ups++;
            else if (last10[i].quote < last10[i - 1].quote) downs++;
        }
        const totalMoves = ups + downs || 1;
        const trendPct = (ups / totalMoves) * 100;
        const isRise = trendPct >= 50;
        const confidence = isRise ? trendPct : 100 - trendPct;
        if (confidence >= 60) {
            signals.push({
                type: 'rise_fall',
                strategyName: 'Rise / Fall',
                status: 'TRADE NOW',
                probability: confidence,
                recommendation: isRise ? 'RISE' : 'FALL',
                entryCondition: `Trade ${isRise ? 'RISE' : 'FALL'} - Trend detected in recent ticks`,
            });
        }
    }

    return signals;
};

const generateProSignals = (analysis: TAnalysisResult, ticks: TTickPoint[], rawDigits: number[]): TSignal[] => {
    const signals: TSignal[] = [];

    // Pro Even / Odd
    // EVEN Strategy
    const min2EvenFreq = analysis.digitFrequencies.filter(f => f.digit % 2 === 0 && f.percentage >= 11).length >= 2;
    const last20Digits = rawDigits.slice(-20);
    const evenInLast20 = last20Digits.filter(d => d % 2 === 0).length;
    const lastStreak = analysis.streaks[analysis.streaks.length - 1];

    if (analysis.evenPercentage >= 55 && min2EvenFreq && analysis.powerIndex.strongest % 2 === 0 && evenInLast20 >= 11) {
        const isOddsStreak = lastStreak && lastStreak.digit % 2 !== 0 && lastStreak.count >= 3;
        signals.push({
            type: 'pro_even_odd',
            strategyName: 'Pro Even / Odd',
            status: isOddsStreak ? 'TRADE NOW' : 'WAIT',
            probability: analysis.evenPercentage,
            recommendation: 'PRO EVEN STRATEGY',
            entryCondition: isOddsStreak
                ? `EVEN STRATEGY: ${lastStreak.count} consecutive odds detected - Enter EVEN now!`
                : 'Wait for 3+ consecutive ODD digits, then enter EVEN',
        });
    }

    // ODD Strategy
    const min2OddFreq = analysis.digitFrequencies.filter(f => f.digit % 2 !== 0 && f.percentage >= 11).length >= 2;
    const oddInLast20 = last20Digits.filter(d => d % 2 !== 0).length;

    if (analysis.oddPercentage >= 70 && min2OddFreq && analysis.powerIndex.strongest % 2 !== 0 && oddInLast20 >= 14) {
        const isEvensStreak = lastStreak && lastStreak.digit % 2 === 0 && lastStreak.count >= 3;
        signals.push({
            type: 'pro_even_odd',
            strategyName: 'Pro Even / Odd',
            status: isEvensStreak ? 'TRADE NOW' : 'WAIT',
            probability: analysis.oddPercentage,
            recommendation: 'PRO ODD STRATEGY',
            entryCondition: isEvensStreak
                ? `ODD STRATEGY: ${lastStreak.count} consecutive evens detected - Enter ODD now!`
                : 'Wait for 3+ consecutive EVEN digits, then enter ODD',
        });
    }

    // Pro Over / Under
    // Over 1 Strategy
    const over1FreqOk = analysis.digitFrequencies.filter(f => f.digit >= 2 && f.percentage >= 11).length >= 3;
    const weakest0or1 = analysis.powerIndex.weakest === 0 || analysis.powerIndex.weakest === 1;
    const over1InLast20 = last20Digits.filter(d => d > 1).length;
    if (analysis.digitFrequencies[0].percentage < 10 && analysis.digitFrequencies[1].percentage < 10 && over1FreqOk && weakest0or1 && analysis.highPercentage >= 90) {
        const isTradeNow = over1InLast20 >= 18;
        signals.push({
            type: 'pro_over_under',
            strategyName: 'Pro Over / Under',
            status: isTradeNow ? 'TRADE NOW' : 'WAIT',
            probability: analysis.highPercentage,
            recommendation: 'PRO OVER 1',
            entryCondition: isTradeNow
                ? 'OVER 1 STRATEGY: Strong signal - 90%+ win rate detected!'
                : 'Wait for 1+ UNDER digits, then enter OVER 1 immediately',
            targetDigit: 1,
        });
    }

    // Under 8 Strategy
    const under8FreqOk = analysis.digitFrequencies.filter(f => f.digit <= 7 && f.percentage >= 11).length >= 3;
    const weakest8or9 = analysis.powerIndex.weakest === 8 || analysis.powerIndex.weakest === 9;
    const under8InLast20 = last20Digits.filter(d => d < 8).length;
    if (analysis.digitFrequencies[8].percentage < 10 && analysis.digitFrequencies[9].percentage < 10 && under8FreqOk && weakest8or9 && analysis.lowPercentage >= 90) {
        const isTradeNow = under8InLast20 >= 18;
        signals.push({
            type: 'pro_over_under',
            strategyName: 'Pro Over / Under',
            status: isTradeNow ? 'TRADE NOW' : 'WAIT',
            probability: analysis.lowPercentage,
            recommendation: 'PRO UNDER 8',
            entryCondition: isTradeNow
                ? 'UNDER 8 STRATEGY: Strong signal - 90%+ win rate detected!'
                : 'Wait for 1+ OVER digits, then enter UNDER 8 immediately',
            targetDigit: 8,
        });
    }

    // Pro Differs
    const rareDigits = analysis.digitFrequencies.filter(f => f.percentage < 9).map(f => f.digit);
    if (rareDigits.length >= 2) {
        const avgRarePercent = rareDigits.reduce((acc, d) => acc + analysis.digitFrequencies[d].percentage, 0) / rareDigits.length;
        signals.push({
            type: 'pro_differs',
            strategyName: 'Pro Differs',
            status: 'TRADE NOW',
            probability: 100 - avgRarePercent,
            recommendation: `DIFFERS ${rareDigits.join(', ')}`,
            entryCondition: `Wait for any rare digit (${rareDigits.join(', ')}) to appear, then trade DIFFERS`,
            targetDigit: rareDigits[0],
        });
    }

    // Under 7 Strategy (digits 0-6 primary)
    const d789Under10Count = [7, 8, 9].filter(d => analysis.digitFrequencies[d].percentage < 10).length;
    if (d789Under10Count >= 2) {
        const u7Digits = rawDigits.slice(-10);
        const allU7Ok = u7Digits.every(d => d < 7);
        const entryDigit = [7, 8, 9].find(d => analysis.digitFrequencies[d].percentage >= 10) ?? 7;
        const u7Percent = analysis.digitFrequencies.filter(f => f.digit <= 6).reduce((acc, f) => acc + f.percentage, 0);
        signals.push({
            type: 'under_7',
            strategyName: 'Under 7 Strategy',
            status: allU7Ok ? 'TRADE NOW' : 'WAIT',
            probability: u7Percent,
            recommendation: 'UNDER 7',
            entryCondition: `Use digit ${entryDigit} as entry point when it appears, otherwise wait`,
            targetDigit: 7,
        });
    }

    // Over 2 Strategy (digits 3-9 primary)
    const d012Under10Count = [0, 1, 2].filter(d => analysis.digitFrequencies[d].percentage < 10).length;
    if (d012Under10Count >= 2) {
        const o2Digits = rawDigits.slice(-10);
        const allO2Ok = o2Digits.every(d => d > 2);
        const entryDigit = [0, 1, 2].find(d => analysis.digitFrequencies[d].percentage >= 10) ?? 2;
        const o2Percent = analysis.digitFrequencies.filter(f => f.digit >= 3).reduce((acc, f) => acc + f.percentage, 0);
        signals.push({
            type: 'over_2',
            strategyName: 'Over 2 Strategy',
            status: allO2Ok ? 'TRADE NOW' : 'WAIT',
            probability: o2Percent,
            recommendation: 'OVER 2',
            entryCondition: `Use digit ${entryDigit} as entry point when it appears, otherwise wait`,
            targetDigit: 2,
        });
    }

    return signals;
};

const generateBlocklyXml = (symbol: string, strategyName: string, signal: TSignal, stake: number) => {
    let tradeTypeCat = 'digits';
    let tradeType = 'evenodd';
    let contractType = 'DIGITEVEN';
    let hasPrediction = 'false';
    let predictionValue = '0';
    let beforePurchaseStack = '';

    if (strategyName.includes('Even') || strategyName.includes('Odd') || signal.type === 'even_odd' || signal.type === 'pro_even_odd') {
        tradeTypeCat = 'digits';
        tradeType = 'evenodd';
        contractType = signal.recommendation.includes('EVEN') ? 'DIGITEVEN' : 'DIGITODD';
        hasPrediction = 'false';
        beforePurchaseStack = `
          <block type="controls_if" id="if_cond">
            <value name="IF0">
              <block type="logic_compare" id="comp">
                <field name="OP">GTE</field>
                <value name="A">
                  <block type="even_odd_percent" id="eo_pct">
                    <field name="TYPE">${contractType === 'DIGITEVEN' ? 'EVEN' : 'ODD'}</field>
                    <field name="N">10</field>
                  </block>
                </value>
                <value name="B">
                  <block type="math_number" id="num">
                    <field name="NUM">60</field>
                  </block>
                </value>
              </block>
            </value>
            <statement name="DO0">
              <block type="purchase" id="purch">
                <field name="PURCHASE_LIST">${contractType}</field>
              </block>
            </statement>
          </block>
        `;
    } else if (strategyName.includes('Over') || strategyName.includes('Under') || signal.type === 'over_under' || signal.type === 'pro_over_under' || strategyName.includes('Under 7') || strategyName.includes('Over 2')) {
        tradeTypeCat = 'digits';
        tradeType = 'overunder';
        
        let isOver = true;
        let thresh = 4;
        if (strategyName.includes('Under 7')) {
            isOver = false;
            thresh = 7;
        } else if (strategyName.includes('Over 2')) {
            isOver = true;
            thresh = 2;
        } else if (strategyName.includes('Over 1') || signal.recommendation.includes('OVER 1')) {
            isOver = true;
            thresh = 1;
        } else if (strategyName.includes('Under 8') || signal.recommendation.includes('UNDER 8')) {
            isOver = false;
            thresh = 8;
        } else {
            isOver = signal.recommendation.includes('OVER');
            thresh = signal.targetDigit ?? 4;
        }
        
        contractType = isOver ? 'DIGITOVER' : 'DIGITUNDER';
        hasPrediction = 'true';
        predictionValue = String(thresh);
        beforePurchaseStack = `
          <block type="controls_if" id="if_cond">
            <value name="IF0">
              <block type="logic_compare" id="comp">
                <field name="OP">GTE</field>
                <value name="A">
                  <block type="over_under_percent" id="ou_pct">
                    <field name="TYPE">${isOver ? 'OVER' : 'UNDER'}</field>
                    <field name="THRESH">${thresh}</field>
                    <field name="N">10</field>
                  </block>
                </value>
                <value name="B">
                  <block type="math_number" id="num">
                    <field name="NUM">60</field>
                  </block>
                </value>
              </block>
            </value>
            <statement name="DO0">
              <block type="purchase" id="purch">
                <field name="PURCHASE_LIST">${contractType}</field>
              </block>
            </statement>
          </block>
        `;
    } else if (strategyName.includes('Matches') || strategyName.includes('Differs') || signal.type === 'matches' || signal.type === 'differs' || signal.type === 'pro_differs') {
        tradeTypeCat = 'digits';
        tradeType = 'matchesdiffers';
        const isMatch = strategyName.includes('Matches') || signal.type === 'matches';
        contractType = isMatch ? 'DIGITMATCH' : 'DIGITDIFF';
        hasPrediction = 'true';
        const val = signal.targetDigit ?? 5;
        predictionValue = String(val);
        beforePurchaseStack = `
          <block type="controls_if" id="if_cond">
            <value name="IF0">
              <block type="logic_compare" id="comp">
                <field name="OP">${isMatch ? 'GTE' : 'LTE'}</field>
                <value name="A">
                  <block type="match_diff_percent" id="md_pct">
                    <field name="TYPE">${isMatch ? 'MATCH' : 'DIFFER'}</field>
                    <field name="VAL">${val}</field>
                    <field name="N">10</field>
                  </block>
                </value>
                <value name="B">
                  <block type="math_number" id="num">
                    <field name="NUM">${isMatch ? '15' : '9'}</field>
                  </block>
                </value>
              </block>
            </value>
            <statement name="DO0">
              <block type="purchase" id="purch">
                <field name="PURCHASE_LIST">${contractType}</field>
              </block>
            </statement>
          </block>
        `;
    } else {
        tradeTypeCat = 'callput';
        tradeType = 'callput';
        contractType = signal.recommendation.includes('RISE') ? 'CALL' : 'PUT';
        hasPrediction = 'false';
        beforePurchaseStack = `
          <block type="controls_if" id="if_cond">
            <value name="IF0">
              <block type="logic_compare" id="comp">
                <field name="OP">GTE</field>
                <value name="A">
                  <block type="rise_fall_percent" id="rf_pct">
                    <field name="TYPE">${contractType === 'CALL' ? 'RISE' : 'FALL'}</field>
                    <field name="N">10</field>
                  </block>
                </value>
                <value name="B">
                  <block type="math_number" id="num">
                    <field name="NUM">60</field>
                  </block>
                </value>
              </block>
            </value>
            <statement name="DO0">
              <block type="purchase" id="purch">
                <field name="PURCHASE_LIST">${contractType}</field>
              </block>
            </statement>
          </block>
        `;
    }

    return `
<xml xmlns="http://www.w3.org/1999/xhtml" collection="false" is_dbot="true">
  <variables></variables>
  <block type="trade_definition" x="0" y="0">
    <statement name="TRADE_OPTIONS">
      <block type="trade_definition_market" deletable="false" movable="false">
        <field name="MARKET_LIST">synthetic_index</field>
        <field name="SUBMARKET_LIST">random_index</field>
        <field name="SYMBOL_LIST">${symbol}</field>
        <next>
          <block type="trade_definition_tradetype" deletable="false" movable="false">
            <field name="TRADETYPECAT_LIST">${tradeTypeCat}</field>
            <field name="TRADETYPE_LIST">${tradeType}</field>
            <next>
              <block type="trade_definition_contracttype" deletable="false" movable="false">
                <field name="TYPE_LIST">both</field>
                <next>
                  <block type="trade_definition_candleinterval" deletable="false" movable="false">
                    <field name="CANDLEINTERVAL_LIST">60</field>
                    <next>
                      <block type="trade_definition_restartbuysell" deletable="false" movable="false">
                        <field name="TIME_MACHINE_ENABLED">FALSE</field>
                        <next>
                          <block type="trade_definition_restartonerror" deletable="false" movable="false">
                            <field name="RESTARTONERROR">TRUE</field>
                          </block>
                        </next>
                      </block>
                    </next>
                  </block>
                </next>
              </block>
            </next>
          </block>
        </next>
      </block>
    </statement>
    <statement name="SUBMARKET">
      <block type="trade_definition_tradeoptions">
        <mutation has_first_barrier="false" has_second_barrier="false" has_prediction="${hasPrediction}"></mutation>
        <field name="DURATIONTYPE_LIST">t</field>
        <field name="CURRENCY_LIST">USD</field>
        <value name="DURATION">
          <shadow type="math_number_positive">
            <field name="NUM">1</field>
          </shadow>
        </value>
        <value name="AMOUNT">
          <shadow type="math_number_positive">
            <field name="NUM">${stake}</field>
          </shadow>
        </value>
        ${hasPrediction === 'true' ? `
        <value name="PREDICTION">
          <shadow type="math_number_positive">
            <field name="NUM">${predictionValue}</field>
          </shadow>
        </value>
        ` : ''}
      </block>
    </statement>
  </block>
  <block type="during_purchase" x="720" y="0">
    <statement name="DURING_PURCHASE_STACK">
      <block type="controls_if">
        <value name="IF0">
          <block type="check_sell"></block>
        </value>
      </block>
    </statement>
  </block>
  <block type="after_purchase" x="720" y="248">
    <statement name="AFTERPURCHASE_STACK">
      <block type="trade_again"></block>
    </statement>
  </block>
  <block type="before_purchase" x="0" y="576">
    <statement name="BEFOREPURCHASE_STACK">
      ${beforePurchaseStack}
    </statement>
  </block>
</xml>
    `.trim();
};

const Scanner = observer(() => {
    const { dashboard } = useStore();
    const { active_tab } = dashboard;
    const showScanner = active_tab === DBOT_TABS.SCANNER || dashboard.is_floating_scanner_visible;

    // State for tracking selected strategies to scan
    const [selectedStrategies, setSelectedStrategies] = useState<Record<string, boolean>>(() => {
        const initial: Record<string, boolean> = {};
        STRATEGY_DEFINITIONS.forEach(s => {
            initial[s.id] = true;
        });
        return initial;
    });

    // Market ticks mapping
    const [marketTicks, setMarketTicks] = useState<Record<string, TTickPoint[]>>({});
    const [selectedSymbol, setSelectedSymbol] = useState('R_10');
    const [activeSignalsTab, setActiveSignalsTab] = useState<'standard' | 'pro' | 'super'>('standard');
    const [stake, setStake] = useState('1');

    const subscriptionsRef = useRef<Record<string, { unsubscribe?: () => void }>>({});
    const marketTicksRef = useRef<Record<string, TTickPoint[]>>({});

    const handleLoadStrategyToBotBuilder = useCallback((symbol: string, strategyName: string, signal: TSignal) => {
        const xml = generateBlocklyXml(symbol, strategyName, signal, Number(stake) || 1);
        const workspace = window.Blockly?.derivWorkspace;
        if (workspace) {
            void load({
                block_string: xml,
                file_name: `${strategyName} - ${symbol}`,
                strategy_id: 'scanner_generated_strategy',
                from: 'local',
                workspace,
                showIncompatibleStrategyDialog: false,
                show_snackbar: true,
            }).then(() => {
                dashboard.setFloatingScannerVisibility(false);
                dashboard.setActiveTab(DBOT_TABS.BOT_BUILDER);
            });
        }
    }, [dashboard, stake]);

    const handleTickUpdate = useCallback((symbol: string, tick: TTickPoint) => {
        const currentTicks = marketTicksRef.current[symbol] || [];
        const nextTicks = [...currentTicks, tick].slice(-100);
        marketTicksRef.current[symbol] = nextTicks;

        setMarketTicks(prev => ({
            ...prev,
            [symbol]: nextTicks,
        }));
    }, []);

    const subscribeToAllMarkets = useCallback(async () => {
        if (!showScanner || !api_base.api) return;

        // Fetch histories first
        await Promise.all(
            MARKETS.map(async market => {
                try {
                    const history = await api_base.api.send({
                        adjust_start_time: 1,
                        count: 100,
                        end: 'latest',
                        start: 1,
                        style: 'ticks',
                        ticks_history: market.symbol,
                    });

                    const prices = Array.isArray(history?.history?.prices) ? history.history.prices : [];
                    const times = Array.isArray(history?.history?.times) ? history.history.times : [];
                    const historyTicks = prices
                        .map((price: number | string, index: number) => ({
                            epoch: Number(times[index]) || Math.floor(Date.now() / 1000),
                            quote: Number(price),
                        }))
                        .filter((t: TTickPoint) => Number.isFinite(t.quote));

                    marketTicksRef.current[market.symbol] = historyTicks;
                    setMarketTicks(prev => ({
                        ...prev,
                        [market.symbol]: historyTicks,
                    }));
                } catch {
                    // Suppress loading failures for individual markets
                }
            })
        );

        // Subscribe to tick streams
        MARKETS.forEach(market => {
            try {
                const observable = (api_base.api as any).subscribe({ ticks: market.symbol });
                subscriptionsRef.current[market.symbol] = safeSubscribe(observable, (data: any) => {
                    const quote = Number(data?.tick?.quote);
                    if (Number.isFinite(quote)) {
                        handleTickUpdate(market.symbol, {
                            epoch: Number(data?.tick?.epoch) || Math.floor(Date.now() / 1000),
                            quote,
                        });
                    }
                });
            } catch {
                // Suppress subscription failures
            }
        });
    }, [handleTickUpdate, showScanner]);

    const unsubscribeFromAllMarkets = useCallback(() => {
        Object.keys(subscriptionsRef.current).forEach(symbol => {
            try {
                subscriptionsRef.current[symbol]?.unsubscribe?.();
            } catch {
                // Suppress stream closing errors
            }
        });
        subscriptionsRef.current = {};
    }, []);

    useEffect(() => {
        if (showScanner) {
            void subscribeToAllMarkets();
        }
        return () => {
            unsubscribeFromAllMarkets();
        };
    }, [showScanner, subscribeToAllMarkets, unsubscribeFromAllMarkets]);

    if (!showScanner) return null;

    // Multi-market active signals computation
    const activeSignals: { symbol: string; marketLabel: string; signal: TSignal }[] = [];
    const detailedAnalyses: Record<string, TAnalysisResult> = {};

    MARKETS.forEach(market => {
        const ticks = marketTicks[market.symbol] || [];
        if (ticks.length > 0) {
            const rawDigits = ticks.map(t => getLastDigitFromQuote(t.quote, market.symbol));
            const analysis = runAnalysis(ticks, market.symbol);
            detailedAnalyses[market.symbol] = analysis;

            // Generate standard signals
            if (selectedStrategies.even_odd || selectedStrategies.over_under || selectedStrategies.matches || selectedStrategies.differs || selectedStrategies.rise_fall) {
                const std = generateSignals(analysis, ticks);
                std.forEach(s => {
                    if (selectedStrategies[s.type]) {
                        activeSignals.push({ symbol: market.symbol, marketLabel: market.label, signal: s });
                    }
                });
            }

            // Generate pro signals
            if (selectedStrategies.pro_even_odd || selectedStrategies.pro_over_under || selectedStrategies.pro_differs || selectedStrategies.under_7 || selectedStrategies.over_2) {
                const pro = generateProSignals(analysis, ticks, rawDigits);
                pro.forEach(s => {
                    if (selectedStrategies[s.type]) {
                        activeSignals.push({ symbol: market.symbol, marketLabel: market.label, signal: s });
                    }
                });
            }

            // Generate super signals (combines all, threshold >= 65%)
            if (selectedStrategies.super_signals) {
                const std = generateSignals(analysis, ticks);
                const pro = generateProSignals(analysis, ticks, rawDigits);
                [...std, ...pro].forEach(s => {
                    if (s.probability >= 65) {
                        activeSignals.push({
                            symbol: market.symbol,
                            marketLabel: market.label,
                            signal: {
                                ...s,
                                strategyName: 'Super Signals (Real-time)',
                                status: s.probability >= 90 ? 'STRONG' : 'TRADE NOW',
                            },
                        });
                    }
                });
            }
        }
    });

    // Filtering by selected signals tab
    const filteredSignals = activeSignals.filter(item => {
        if (activeSignalsTab === 'standard') {
            return ['even_odd', 'over_under', 'matches', 'differs', 'rise_fall'].includes(item.signal.type) && item.signal.strategyName !== 'Super Signals (Real-time)';
        }
        if (activeSignalsTab === 'pro') {
            return ['pro_even_odd', 'pro_over_under', 'pro_differs', 'under_7', 'over_2'].includes(item.signal.type) && item.signal.strategyName !== 'Super Signals (Real-time)';
        }
        return item.signal.strategyName === 'Super Signals (Real-time)';
    });

    // Sort by probability descending
    filteredSignals.sort((a, b) => b.signal.probability - a.signal.probability);

    const selectedMarketAnalysis = detailedAnalyses[selectedSymbol];
    const selectedMarketTicks = marketTicks[selectedSymbol] || [];

    return (
        <div className='dc-scanner'>
            {/* Top Toolbar Selector */}
            <div className='dc-scanner__header'>
                <div className='dc-scanner__title-row'>
                    <h2 className='dc-scanner__title'>
                        <Localize i18n_default_text='Real-Time Market Distribution Scanner' />
                    </h2>
                    <div className='dc-scanner__stake-box'>
                        <label htmlFor='scanner-stake'>
                            <Localize i18n_default_text='Stake (USD)' />
                        </label>
                        <input
                            id='scanner-stake'
                            type='number'
                            value={stake}
                            onChange={e => setStake(e.target.value)}
                            min='0.35'
                            step='0.1'
                            aria-label={localize('Stake amount')}
                            title={localize('Stake amount')}
                        />
                    </div>
                </div>

                {/* Checklist configuration section */}
                <div className='dc-scanner__strategies-selector'>
                    <span className='dc-scanner__selector-title'>
                        <Localize i18n_default_text='Monitored Strategies:' />
                    </span>
                    <div className='dc-scanner__selector-grid'>
                        {STRATEGY_DEFINITIONS.map(strategy => (
                            <label className='dc-scanner__checkbox-label' key={strategy.id}>
                                <input
                                    type='checkbox'
                                    checked={selectedStrategies[strategy.id] || false}
                                    onChange={e => {
                                        setSelectedStrategies(prev => ({
                                            ...prev,
                                            [strategy.id]: e.target.checked,
                                        }));
                                    }}
                                    aria-label={strategy.name}
                                    title={strategy.name}
                                />
                                <span className={`strategy-badge strategy-badge--${strategy.type}`}>
                                    {strategy.name}
                                </span>
                            </label>
                        ))}
                    </div>
                </div>
            </div>

            {/* Main scanner grid */}
            <div className='dc-scanner__content'>
                {/* Left section: Markets and Ticks Feed */}
                <div className='dc-scanner__pane dc-scanner__pane--left'>
                    <h3 className='dc-scanner__section-title'>
                        <Localize i18n_default_text='Market Overview' />
                    </h3>
                    <div className='dc-scanner__markets-list'>
                        {MARKETS.map(market => {
                            const ticks = marketTicks[market.symbol] || [];
                            const latest = ticks[ticks.length - 1];
                            const prev = ticks[ticks.length - 2];
                            const trend = latest && prev ? (latest.quote >= prev.quote ? 'up' : 'down') : 'flat';
                            const marketAnalysis = detailedAnalyses[market.symbol];
                            const entropyVal = marketAnalysis ? marketAnalysis.entropy : 0;
                            const isSelected = selectedSymbol === market.symbol;

                            return (
                                <div
                                    className={`dc-scanner__market-card ${isSelected ? 'dc-scanner__market-card--active' : ''}`}
                                    key={market.symbol}
                                    onClick={() => setSelectedSymbol(market.symbol)}
                                >
                                    <div className='dc-scanner__market-card-header'>
                                        <span className='dc-scanner__market-name'>{market.label}</span>
                                        <span className={`dc-scanner__market-trend dc-scanner__market-trend--${trend}`}>
                                            {trend === 'up' ? '▲' : trend === 'down' ? '▼' : '■'}
                                        </span>
                                    </div>
                                    <div className='dc-scanner__market-card-body'>
                                        <div className='dc-scanner__market-stat'>
                                            <span className='label'>Last quote:</span>
                                            <span className='value'>{latest ? latest.quote.toFixed(2) : '--'}</span>
                                        </div>
                                        <div className='dc-scanner__market-stat'>
                                            <span className='label'>Entropy:</span>
                                            <span className='value'>{entropyVal.toFixed(4)}</span>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* Middle section: Detailed analysis graphs for selected index */}
                <div className='dc-scanner__pane dc-scanner__pane--middle'>
                    <h3 className='dc-scanner__section-title'>
                        <Localize
                            i18n_default_text='Digit Analysis: {{market}}'
                            values={{ market: MARKETS.find(m => m.symbol === selectedSymbol)?.label || '' }}
                        />
                    </h3>

                    {selectedMarketAnalysis ? (
                        <div className='dc-scanner__analysis-dashboard'>
                            {/* Detailed Statistics Grid */}
                            <div className='dc-scanner__stat-grid'>
                                <div className='dc-scanner__stat-item'>
                                    <span className='label'>Even / Odd %</span>
                                    <span className='value'>
                                        {selectedMarketAnalysis.evenPercentage.toFixed(0)}% /{' '}
                                        {selectedMarketAnalysis.oddPercentage.toFixed(0)}%
                                    </span>
                                </div>
                                <div className='dc-scanner__stat-item'>
                                    <span className='label'>Over / Under 4.5%</span>
                                    <span className='value'>
                                        {selectedMarketAnalysis.highPercentage.toFixed(0)}% /{' '}
                                        {selectedMarketAnalysis.lowPercentage.toFixed(0)}%
                                    </span>
                                </div>
                                <div className='dc-scanner__stat-item'>
                                    <span className='label'>Gap (Power Index)</span>
                                    <span className='value'>
                                        {selectedMarketAnalysis.powerIndex.gap.toFixed(1)}%
                                    </span>
                                </div>
                                <div className='dc-scanner__stat-item'>
                                    <span className='label'>Missing digits</span>
                                    <span className='value'>
                                        {selectedMarketAnalysis.missingDigits.length > 0
                                            ? selectedMarketAnalysis.missingDigits.join(', ')
                                            : 'None'}
                                    </span>
                                </div>
                            </div>

                            {/* Frequencies Bar Chart */}
                            <div className='dc-scanner__frequencies'>
                                <h4 className='dc-scanner__frequencies-title'>
                                    <Localize i18n_default_text='Digit Frequencies (0-9)' />
                                </h4>
                                <div className='dc-scanner__frequencies-chart'>
                                    {selectedMarketAnalysis.digitFrequencies.map(freq => {
                                        const isStrongest = freq.digit === selectedMarketAnalysis.powerIndex.strongest;
                                        const isWeakest = freq.digit === selectedMarketAnalysis.powerIndex.weakest;
                                        const heightBucket = Math.round(freq.percentage / 10) * 10;
                                        const heightClass = `dc-scanner__freq-bar--${heightBucket}`;
                                        return (
                                            <div className='dc-scanner__freq-bar-wrapper' key={freq.digit}>
                                                <div className='dc-scanner__freq-bar-container'>
                                                    <div
                                                        className={`dc-scanner__freq-bar ${heightClass} ${isStrongest ? 'dc-scanner__freq-bar--strongest' : ''} ${isWeakest ? 'dc-scanner__freq-bar--weakest' : ''}`}
                                                    />
                                                </div>
                                                <span className='dc-scanner__freq-digit'>{freq.digit}</span>
                                                <span className='dc-scanner__freq-percentage'>
                                                    {freq.percentage.toFixed(0)}%
                                                </span>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>

                            {/* Recent streaks */}
                            <div className='dc-scanner__streaks-container'>
                                <h4 className='dc-scanner__frequencies-title'>
                                    <Localize i18n_default_text='Recent Consecutive Streaks' />
                                </h4>
                                <div className='dc-scanner__streaks-list'>
                                    {selectedMarketAnalysis.streaks.length > 0 ? (
                                        selectedMarketAnalysis.streaks.map((streak, i) => (
                                            <div className='dc-scanner__streak-item' key={i}>
                                                Digit <span className='digit-badge'>{streak.digit}</span> appeared{' '}
                                                <span className='count-badge'>{streak.count}x</span> consecutively
                                            </div>
                                        ))
                                    ) : (
                                        <div className='dc-scanner__empty-state'>
                                            <Localize i18n_default_text='Waiting for consecutive digit streaks...' />
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className='dc-scanner__empty-state'>
                            <Localize i18n_default_text='Connecting and loading historical ticks history...' />
                        </div>
                    )}
                </div>

                {/* Right section: Combined live signals feed */}
                <div className='dc-scanner__pane dc-scanner__pane--right'>
                    <div className='dc-scanner__signals-header'>
                        <h3 className='dc-scanner__section-title'>
                            <Localize i18n_default_text='Active Signals Feed' />
                        </h3>
                        <div className='dc-scanner__signals-tabs'>
                            <button
                                type='button'
                                className={`dc-scanner__sig-tab ${activeSignalsTab === 'standard' ? 'dc-scanner__sig-tab--active' : ''}`}
                                onClick={() => setActiveSignalsTab('standard')}
                                aria-label={localize('Show standard signals')}
                                title={localize('Show standard signals')}
                            >
                                <Localize i18n_default_text='Standard' />
                            </button>
                            <button
                                type='button'
                                className={`dc-scanner__sig-tab ${activeSignalsTab === 'pro' ? 'dc-scanner__sig-tab--active' : ''}`}
                                onClick={() => setActiveSignalsTab('pro')}
                                aria-label={localize('Show pro signals')}
                                title={localize('Show pro signals')}
                            >
                                <Localize i18n_default_text='Pro' />
                            </button>
                            <button
                                type='button'
                                className={`dc-scanner__sig-tab ${activeSignalsTab === 'super' ? 'dc-scanner__sig-tab--active' : ''}`}
                                onClick={() => setActiveSignalsTab('super')}
                                aria-label={localize('Show super signals')}
                                title={localize('Show super signals')}
                            >
                                <Localize i18n_default_text='Super' />
                            </button>
                        </div>
                    </div>

                    <div className='dc-scanner__signals-feed'>
                        {filteredSignals.length > 0 ? (
                            filteredSignals.map((item, index) => (
                                <div className='dc-scanner__signal-card' key={`${item.symbol}-${index}`}>
                                    <div className='dc-scanner__signal-card-header'>
                                        <span className='market-badge'>{item.marketLabel}</span>
                                        <span className={`status-badge status-badge--${item.signal.status.replace(/\s+/g, '-').toLowerCase()}`}>
                                            {item.signal.status}
                                        </span>
                                    </div>
                                    <div className='dc-scanner__signal-card-body'>
                                        <div className='strategy-info'>
                                            <span className='strategy-name'>{item.signal.strategyName}</span>
                                            <span className='probability-badge'>
                                                {item.signal.probability.toFixed(0)}%
                                            </span>
                                        </div>
                                        <div className='recommendation'>
                                            Recommendation: <strong>{item.signal.recommendation}</strong>
                                        </div>
                                        <div className='entry-condition'>{item.signal.entryCondition}</div>
                                    </div>
                                    <div className='dc-scanner__signal-card-footer'>
                                        <button
                                            type='button'
                                            className='dc-scanner__load-btn'
                                            onClick={() =>
                                                handleLoadStrategyToBotBuilder(
                                                    item.symbol,
                                                    item.signal.strategyName,
                                                    item.signal
                                                )
                                            }
                                            aria-label={localize('Load strategy to bot builder')}
                                            title={localize('Load strategy to bot builder')}
                                        >
                                            <Localize i18n_default_text='Load to Bot Builder' />
                                        </button>
                                    </div>
                                </div>
                            ))
                        ) : (
                            <div className='dc-scanner__empty-state'>
                                <Localize i18n_default_text='No active signals matching selected criteria.' />
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
});

export default Scanner;
