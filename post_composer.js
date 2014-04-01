/**
* Post Composer
* http://support.proboards.com/user/2671
* Copyright (C) 2014 pixelDepth.net All Rights Reserved.
*/

$(function(){
	(function(){

		return {

			attack: 0.2,
			release: 0.5,
			type: "sawtooth",
			volume: 1,

			starting_key: 1,
			ending_key: 88,

			context: null,
			oscillator: null,
			gain: null,

			recording: false,
			recordings: {},
			recording_id: 0,
			recordings_count: 0,

			key_lookup: {},

			MAX_KEY_SPACE: 3700,

			images: null,

			init: function(){
				if(AudioContext || webkitAudioContext){
					this.setup();

					if(yootil.location.check.posting()){
						this.context = new AudioContext();
						this.oscillator = this.context.createOscillator();
						this.gain = this.context.createGain();

						this.gain.gain.value = 0;

						this.oscillator.start(0);
						this.oscillator.frequency.value = 440;
						this.oscillator.type = "sawtooth";
						this.oscillator.connect(this.gain);

						this.gain.connect(this.context.destination);

						this.create_composer();
					}
				}
			},

			setup: function(){
				var plugin = proboards.plugin.get("pixeldepth_post_composer");
				var settings = (plugin && plugin.settings)? plugin.settings : false;

				if(plugin.images){
					this.images = plugin.images;
				}
			},

			create_composer: function(){
				this.create_tab();
			},

			create_octaves: function(){
				var start = 27.5;
				var key = 1;
				var total_keys = 88;
				var octaves = [];
				var total_octaves = 0;
				var key_counter = 0;
				var accidental_matches = [1, 3, 6, 8, 10];
				var letters = "ABCDEFG";
				var letter_counter = 0;

				while(total_octaves < 9){
				    var keys = {};
				    var total_keys = (total_octaves == 8)? 1 : ((total_octaves == 0)? 3 : 12);
					var count = 0;

				    while(total_keys){
						this.key_lookup[(key_counter + 1)] = keys[(key_counter + 1)] = {

							key: (key_counter + 1),
							frequency: start,
							accidental: false

						};

						if(total_octaves != 8){
							keys[(key_counter + 1)].accidental = (total_octaves == 0 && count == 1)? true : (total_octaves != 0 && (accidental_matches.indexOf(count) > -1)? true : false);
						}

						if(keys[(key_counter + 1)].accidental){
							keys[(key_counter + 1)].letter = (keys[key_counter] && keys[key_counter].letter) || letters.substr(letter_counter % 7, 1);;
						} else {
							keys[(key_counter + 1)].letter = letters.substr(letter_counter % 7, 1);
							letter_counter ++;
						}

				        start *= Math.pow(2, 1 / 12);
				        total_keys --;
				        key_counter ++;
				        count ++;
				    }

				    octaves[total_octaves] = keys;
				    octaves[total_octaves].total_keys = count;
				    total_octaves ++;
				}

				return octaves;
			},

			play_recording: function(id){
				if(!this.recordings[id]){
					return;
				}

				var self = this;
				var the_recording = this.recordings[id];
				var first_key = the_recording.keys[0];
				var context = new AudioContext();
				var oscillator = context.createOscillator();
				var gain = context.createGain();

				gain.gain.value = 0;

				oscillator.start(0);
				oscillator.frequency.value = 440;
				oscillator.type = "sawtooth"; // change
				oscillator.connect(gain);

				gain.connect(context.destination);

				var offset = first_key[0] * 1000;
				var start = performance.now() + offset;
				var end = start + (the_recording.end * 1000);
				var current_key = 0;
				var then = performance.now();

				var play_back = function(){
					if((performance.now() + offset) <= end){
						var key = the_recording.keys[current_key] || null;

						if(key){
							var time = (then + (key[0] * 1000));

							if((performance.now() + offset) >= time){
								current_key ++;

								var now = context.currentTime;
								var freq = self.key_lookup[key[1]].frequency;

								gain.gain.cancelScheduledValues(now);
								oscillator.frequency.setValueAtTime(freq, now);
								gain.gain.setValueAtTime(the_recording.volume, now);
								gain.gain.linearRampToValueAtTime(the_recording.volume, now + the_recording.attack);
								gain.gain.linearRampToValueAtTime(0, now + the_recording.attack + the_recording.release);
							}
						} else {
							cancelAnimationFrame(play_back);
						}

						requestAnimationFrame(play_back);
					}
				};

				requestAnimationFrame(play_back);
			},

			create_keyboard: function(){
				var keyboard = "<div class='composer_keyboard'>";

				keyboard += "<ul class='piano'>";

				var octaves = this.octaves = this.create_octaves();

				for(var o = 0; o < octaves.length; o ++){
					for(var k in octaves[o]){
						if(k == "total_keys" || octaves[o][k].accidental){
							continue;
						}

						if(octaves[o][k].key >= this.starting_key && octaves[o][k].key <= this.ending_key){
							var accidental = "";
							var letter = octaves[o][k].letter;

							if(octaves[o][k - 1] && octaves[o][k - 1].accidental){
								accidental = "<span data-frequency='" + octaves[o][k - 1].frequency + "' data-key='" + octaves[o][k - 1].key + "'></span>";
							}

							keyboard += "<li><div data-frequency='" + octaves[o][k].frequency + "' data-key='" + octaves[o][k].key + "' class='anchor'><strong>" + letter + "</strong></div>" + accidental + "</li>";
						}
					}
				}

				keyboard += "</ul>";
				keyboard += "</div>";

				return keyboard;
			},

			update_key_counter: function(){
				var data = 0;
				var space = 0;

				for(var k in this.recordings){
					data += JSON.stringify(this.recordings[k].keys).length;
				}

				space = (this.MAX_KEY_SPACE - data);
				space = (space < 0)? 0 : space;

				$("#keys_left_counter").text(yootil.number_format(space));
			},

			create_recorded_block: function(id){
				var block_parent = ($(".recordings #recording_one").children().length == 0)? $(".recordings #recording_one") : $(".recordings #recording_two");
				var recording_block = "<div>";

				recording_block += id + "<br />";
				recording_block += "<button data-recording='" + id + "' type='button'>Play</button><br />";

				recording_block += "</div>";

				var self = this;

				block_parent.append($(recording_block).find("button").click(function(){
					self.play_recording($(this).attr("data-recording"));
				}));
			},

			create_tab: function(){
				var self = this;
				var tab = $("<li id='menu-item-postcomposer'><a href='#'>Post Composer</a></li>");
				var wysiwyg_tabs = $("ul.wysiwyg-tabs").append(tab);
				var tab_content = this.create_tab_content();

				$("<div id='postcomposer'>" + tab_content + "</div>").hide().insertBefore($("ul.wysiwyg-tabs"));

				$("#postcomposer .piano div, #postcomposer .piano span").mousedown(function(){
					$(this).addClass("active");

					var now = self.context.currentTime;
					var freq = parseFloat($(this).attr("data-frequency"));

					self.gain.gain.cancelScheduledValues(now);
					self.oscillator.frequency.setValueAtTime(freq, now);
					self.gain.gain.setValueAtTime(self.volume, now);
					self.gain.gain.linearRampToValueAtTime(self.volume, now + self.attack);
					self.gain.gain.linearRampToValueAtTime(0, now + self.attack + self.release);

					if(self.recording){
						if(!self.recording_id){
							self.recording_id = "id_" + Math.floor((Math.random() * 1000));

							if(self.recordings[self.recording_id]){
								self.recording_id = "id_" + Math.floor((Math.random() * 100000));
							}

							self.recordings[self.recording_id] = {

								start: parseFloat(now.toFixed(3)),
								type: self.oscillator.type,
								attack: self.attack,
								release: self.release,
								volume: self.volume,
								keys: []

							};
						}

						self.recordings[self.recording_id].keys.push([

							parseFloat(now.toFixed(2)),
							parseInt($(this).attr("data-key"))

						]);

						self.update_key_counter();
					}
				});

				$("#postcomposer #piano_type").change(function(){
					var value = $(this).val();

					switch(parseInt(value)){

						case 1:
							self.oscillator.type = "sawtooth";
							break;

						case 2:
							self.oscillator.type = "triangle";
							break;

						case 3:
							self.oscillator.type = "sine";
							break;

						case 4:
							self.oscillator.type = "square";
							break;

					}

				});

				$("#postcomposer .slider div#slider_attack").slider({

                  	value: this.attack,
                  	min: 0.01,
                  	max: 3.00,
                  	step: 0.01,
                  	slide: function(e, ui){
                  		$("#slider-attack-amount").html(ui.value);
                  	},

                  	change: function(e, ui){
                  		self.attack = parseFloat(ui.value);
                  	}

				});

				$("#postcomposer .slider div#slider_release").slider({

                  	value: this.release,
                  	min: 0.04,
                  	max: 3.00,
                  	step: 0.01,
                  	slide: function(e, ui){
                  		$("#slider-release-amount").html(ui.value);
                  	},

                  	change: function(e, ui){
                  		self.release = parseFloat(ui.value);
                  	}

				});

				$("#postcomposer .slider div#slider_volume").slider({

                  	value: this.volume,
                  	min: 0.001,
                  	max: 1,
                  	step: 0.001,
                  	slide: function(e, ui){
                  		$("#slider-volume-amount").html(ui.value);
                  	},

                  	change: function(e, ui){
                  		self.volume = parseFloat(ui.value);
                  	}

				});

				$("#postcomposer .piano div, #postcomposer .piano span").mouseup(function(){
					setTimeout(function(){
						$("#postcomposer .piano div, #postcomposer .piano div").removeClass("active");
					}, 200);
				});

				$("#postcomposer #control_record").click(function(){
					if($(this).hasClass("recording")){
						self.recording = false;
						self.recordings[self.recording_id].end = parseFloat(self.context.currentTime.toFixed(3));
						self.create_recorded_block(self.recording_id);

						//self.play_recording(self.recording_id);
						//console.log(self.recordings);
						//console.log(JSON.stringify(self.recordings[self.recording_id].keys).length);

						self.recording_id = 0;

						$(this).removeClass("recording");

						if(self.recordings_count >= 2){
							$(this).addClass("recording_disabled");
						} else {
							$(this).removeClass("recording_disabled");
						}
					} else {
						if(self.recordings_count < 2){
							self.recordings_count ++;
							self.recording = true;
							$(this).addClass("recording");
						}
					}
				});

				wysiwyg_tabs.find("li").click(function(e){
					e.preventDefault();

					$(this).parent().find("li").removeClass("ui-active");
					$(this).addClass("ui-active");

					self.hide_inactive_tabs($(this));

					var id = $(this).attr("id");
					var selector = "";

					if(id){
						selector = "#" + id.split("menu-item-")[1];
					}

					if(id.match(/bbcode|visual/i)){
						$(".ui-wysiwyg .editors").show();
					} else if($(selector).length){
						$(selector).show();
					}
				});
			},

			hide_inactive_tabs: function(active){
				active.parent().find("li").each(function(){
					var id = $(this).attr("id");

					if(id.match(/bbcode|visual/i)){
						$(".ui-wysiwyg .editors").hide();
					} else {
						if(active.attr("id") == id){
							return;
						}

						var selector = "";

						if(id){
							selector = "#" + id.split("menu-item-")[1];
						}

						if($(selector).length){
							$(selector).hide();
						}
					}
				});
			},

			// TODO: Move inline CSS to stylesheet

			create_tab_content: function(){
				var composer_content = "<div style='border: 1px solid #E6E6E6; height: 360px;'>";

				composer_content += this.create_keyboard();
				composer_content += this.create_controls();
				composer_content += this.create_recordings();

				composer_content += "</div>";

				return composer_content;
			},

			create_controls: function(){
				var controls = "<div class='controls'>";
				var left_controls = "<div class='left-controls'>";

				left_controls += "<button type='button' id='control_record'><img src='" + this.images.record + "' />Record</button>";
				left_controls += "<span class='keys_counter'><strong>Key Space Left:</strong> <span id='keys_left_counter'>" + yootil.number_format(this.MAX_KEY_SPACE) + "</span></span>";

				left_controls += "</div>";

				var right_controls = "<div class='right-controls'>";

				right_controls += "<span class='slider'><strong>Volume:</strong> <div id='slider_volume'></div><span id='slider-volume-amount'>1</span></span>";
				right_controls += "<span class='slider'><strong style='left: 8px;'>Attack:</strong> <div id='slider_attack'></div><span id='slider-attack-amount'>0.20</span></span>";
				right_controls += "<span class='slider'><strong>Release:</strong> <div id='slider_release'></div><span id='slider-release-amount'>0.50</span></span>";

				right_controls += "<select id='piano_type'>";
				right_controls += "<option value='1'>Sawtooth</option>";
				right_controls += "<option value='2'>Triangle</option>";
				right_controls += "<option value='3'>Sine</option>";
				right_controls += "<option value='4'>Square</option>";
				right_controls += "</select>";

				right_controls += "</div>";

				controls += left_controls + right_controls + "</div>";


				return controls;
			},

			create_recordings: function(){
				var recordings = "<br style='clear: both' /><div class='recordings'>";
				var style = "style='background-image: url(";

				recordings += "<div id='recording_one' class='recording_one' " + style + this.images.note1 + ");'></div>";
				recordings += "<div id='recording_two' class='recording_two' " + style + this.images.note2 + ");'></div>";

				recordings += "</div>";

				return recordings;
			}

		};

	})().init();
});